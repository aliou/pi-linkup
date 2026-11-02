import { ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import {
  keyHint as defaultKeyHint,
  defineTool,
  formatSize,
  getMarkdownTheme,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "typebox";
import { getClient } from "../../client";
import {
  previewContent,
  structuredContent,
  structuredOutputSchema,
} from "../../lib/output";
import { linkupFetchResponseSchema } from "../../types";

interface WebFetchDetails {
  url?: string;
  markdown?: string;
  structured?: boolean;
  truncated?: boolean;
  fullOutputPath?: string;
  outputLines?: number;
  totalLines?: number;
  outputBytes?: number;
  totalBytes?: number;
}

const parameters = Type.Object({
  url: Type.String({
    description:
      "The URL to fetch. Must point to an HTML page or PDF (PDFs up to 100 MB).",
  }),
  renderJs: Type.Optional(
    Type.Boolean({
      description:
        "Whether to render JavaScript on the page. Default: true (recommended unless the site is known to render server-side). Set to false for faster, cheaper fetching of static pages.",
    }),
  ),
  mode: Type.Optional(
    Type.Union([Type.Literal("standard"), Type.Literal("pro")], {
      description:
        "Retrieval mode. standard (default) for regular pages; pro delivers significantly higher success rates on hard-to-retrieve pages at higher cost (~5-10x).",
    }),
  ),
  schema: Type.Optional(
    Type.Record(Type.String(), Type.Any(), {
      description:
        "Optional JSON Schema of type object describing typed data to extract from this page. When set, the result includes a data object alongside the markdown. Keep it shallow; field descriptions tell the model what to look for. Fields with no grounded value are omitted. Adds a flat $0.001 per call.",
    }),
  ),
  instructions: Type.Optional(
    Type.String({
      maxLength: 4000,
      description:
        "Optional extraction rules the schema cannot express (e.g. currency, which prices to keep, how to split rows). Requires schema. Maximum 4000 characters.",
    }),
  ),
});

type WebFetchParams = Static<typeof parameters>;

const COLLAPSED_PREVIEW_LINES = 8;

export const webFetchTool = defineTool({
  name: "linkup_web_fetch",
  label: "Linkup Web Fetch",
  description:
    "Fetch and extract content from a specific URL (HTML page or PDF) using Linkup API. Returns clean markdown content (truncated to 2000 lines / 50KB; full output saved to a temp file); optionally returns typed JSON when a schema is provided. Use for reading documentation, articles, or any specific webpage.",
  promptSnippet:
    "Fetch and read markdown (or typed JSON) content from a known URL.",
  promptGuidelines: [
    "Use linkup_web_fetch when the URL is already known and the goal is to read the page contents.",
    "Use linkup_web_fetch after linkup_web_search when you need to inspect a promising result in detail.",
    "Set renderJs to false for linkup_web_fetch on static documentation pages when speed matters.",
    "Pass a schema to linkup_web_fetch when you need typed fields (name, price, dates, ...) from a known URL instead of parsing the markdown yourself.",
    "When linkup_web_fetch fails or returns suspiciously little content on a hard-to-retrieve page, retry with mode set to pro.",
  ],
  parameters,
  annotations: { readOnlyHint: true, openWorldHint: true },
  outputSchema: structuredOutputSchema(
    Type.Intersect([
      Type.Object({ url: Type.String() }),
      linkupFetchResponseSchema,
    ]),
  ),

  async execute(
    _toolCallId: string,
    params: WebFetchParams,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<WebFetchDetails> | undefined,
    _ctx: ExtensionContext,
  ) {
    const client = getClient();

    onUpdate?.({
      content: [
        {
          type: "text" as const,
          text: `Fetching ${params.url}...`,
        },
      ],
      details: {},
    });

    const response = await client.fetch({
      url: params.url,
      renderJs: params.renderJs,
      mode: params.mode,
      schema: params.schema,
      instructions: params.instructions,
      signal,
    });

    const sections: string[] = [];
    if (response.data !== undefined) {
      sections.push(
        `## Structured Data\n\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``,
      );
    }
    sections.push(response.markdown);
    const fullContent = sections.join("\n\n");

    const result = await previewContent(fullContent);

    return {
      content: [{ type: "text" as const, text: result.preview }],
      details: {
        url: params.url,
        markdown: result.preview,
        structured: response.data !== undefined,
        truncated: result.truncated,
        fullOutputPath: result.tempFilePath,
        outputLines: result.outputLines,
        totalLines: result.totalLines,
        outputBytes: result.outputBytes,
        totalBytes: result.totalBytes,
      },
      structuredContent: await structuredContent({
        url: params.url,
        ...response,
      }),
    };
  },

  renderCall(args: WebFetchParams, theme: Theme) {
    const optionArgs = [];
    if (args.renderJs === false) {
      optionArgs.push({ label: "js", value: "off" });
    }
    if (args.mode === "pro") {
      optionArgs.push({ label: "mode", value: "pro" });
    }

    return new ToolCallHeader(
      {
        toolName: "Linkup: WebFetch",
        mainArg: args.url,
        showColon: true,
        optionArgs,
      },
      theme,
    );
  },

  renderResult(
    result: AgentToolResult<WebFetchDetails>,
    options: ToolRenderResultOptions,
    theme: Theme,
    context,
  ) {
    const { expanded, isPartial } = options;
    const keyHint = context.keyHint ?? defaultKeyHint;

    if (isPartial) {
      return new Text(theme.fg("muted", "Linkup: WebFetch: fetching..."), 0, 0);
    }

    const details = result.details;
    const container = new Container();

    if (context.isError) {
      const textBlock = result.content.find((c) => c.type === "text");
      const errorMsg =
        (textBlock?.type === "text" && textBlock.text) || "Fetch failed";
      container.addChild(new Text(theme.fg("error", errorMsg), 0, 0));
      return container;
    }

    const markdownText = details?.markdown ?? "";

    if (!expanded) {
      const lines = markdownText.split("\n");
      const visibleText = lines.slice(0, COLLAPSED_PREVIEW_LINES).join("\n");

      container.addChild(
        new Markdown(visibleText, 0, 0, getMarkdownTheme(), {
          color: (text: string) => theme.fg("toolOutput", text),
        }),
      );
    } else {
      container.addChild(
        new Markdown(markdownText, 0, 0, getMarkdownTheme(), {
          color: (text: string) => theme.fg("toolOutput", text),
        }),
      );
    }

    const footerItems: { label: string; value: string }[] = [];
    if (details.structured) {
      footerItems.push({ label: "", value: "structured" });
    }
    if (details.truncated) {
      footerItems.push({
        label: "",
        value: `Showing ${details.outputLines} of ${details.totalLines} lines (${formatSize(details.outputBytes ?? 0)} of ${formatSize(details.totalBytes ?? 0)})`,
      });
      if (details.fullOutputPath) {
        footerItems.push({
          label: "full markdown",
          value: details.fullOutputPath,
        });
      }
    } else {
      const lines = (details.markdown ?? "").split("\n").length;
      footerItems.push({
        label: "",
        value: `${lines} lines (${formatSize(details.totalBytes ?? 0)})`,
      });
    }
    if (!expanded) {
      footerItems.push({
        label: "",
        value: keyHint("app.tools.expand", "to expand"),
      });
    }
    container.addChild(new Text("", 0, 0));
    container.addChild(
      new ToolFooter(theme, {
        items: footerItems,
        separator: " | ",
      }),
    );

    return container;
  },
});
