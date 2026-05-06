import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  getMarkdownTheme,
  keyHint,
  truncateHead,
} from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import { getClient } from "../../client";

interface WebFetchDetails {
  url?: string;
  markdown?: string;
  truncated?: boolean;
  fullOutputPath?: string;
  outputLines?: number;
  totalLines?: number;
  outputBytes?: number;
  totalBytes?: number;
}

const parameters = Type.Object({
  url: Type.String({
    description: "The URL to fetch content from.",
  }),
  renderJs: Type.Optional(
    Type.Boolean({
      description:
        "Whether to render JavaScript on the page. Default: true. Set to false for faster fetching of static pages.",
    }),
  ),
});

type WebFetchParams = Static<typeof parameters>;

const COLLAPSED_PREVIEW_LINES = 8;

export const webFetchTool = {
  name: "linkup_web_fetch",
  label: "Linkup Web Fetch",
  description:
    "Fetch and extract content from a specific URL using Linkup API. Returns clean markdown content (truncated to 2000 lines / 50KB; full output saved to a temp file). Use for reading documentation, articles, or any specific webpage.",
  promptSnippet: "Fetch and read markdown content from a known URL.",
  promptGuidelines: [
    "Use linkup_web_fetch when the URL is already known and the goal is to read the page contents.",
    "Use linkup_web_fetch after linkup_web_search when you need to inspect a promising result in detail.",
    "Set renderJs to false for linkup_web_fetch on static documentation pages when speed matters.",
  ],
  parameters,

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
      signal,
    });

    const result = truncateHead(response.markdown, {
      maxLines: DEFAULT_MAX_LINES,
      maxBytes: DEFAULT_MAX_BYTES,
    });
    let text = result.content;
    let tmpPath: string | undefined;

    if (result.truncated) {
      tmpPath = join(
        tmpdir(),
        `pi-linkup-fetch-${randomBytes(4).toString("hex")}.md`,
      );
      await writeFile(tmpPath, response.markdown, "utf8");
      text += `\n\n[Showing ${result.outputLines} of ${result.totalLines} lines (${formatSize(result.outputBytes)} of ${formatSize(result.totalBytes)}). Full output: ${tmpPath}]`;
    }

    return {
      content: [{ type: "text" as const, text }],
      details: {
        url: params.url,
        markdown: text,
        truncated: result.truncated,
        fullOutputPath: result.truncated ? tmpPath : undefined,
        outputLines: result.outputLines,
        totalLines: result.totalLines,
        outputBytes: result.outputBytes,
        totalBytes: result.totalBytes,
      },
    };
  },

  renderCall(args: WebFetchParams, theme: Theme) {
    const optionArgs = [];
    if (args.renderJs === false) {
      optionArgs.push({ label: "js", value: "off" });
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
  ) {
    const { expanded, isPartial } = options;

    if (isPartial) {
      return new Text(theme.fg("muted", "Linkup: WebFetch: fetching..."), 0, 0);
    }

    const details = result.details;
    const container = new Container();

    // When the tool throws, the framework calls renderResult with
    // details={} (empty object) and the error message in content.
    if (!details?.markdown) {
      const textBlock = result.content.find((c) => c.type === "text");
      const errorMsg =
        (textBlock?.type === "text" && textBlock.text) || "Fetch failed";
      container.addChild(new Text(theme.fg("error", errorMsg), 0, 0));
      return container;
    }

    const markdownText = details.markdown;

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
  // biome-ignore lint/suspicious/noExplicitAny: Type safety provided by registerTool call
} as any;
