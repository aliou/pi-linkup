import { ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme, keyHint } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import { getClient } from "../client";

interface WebFetchDetails {
  url?: string;
  markdown?: string;
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
    "Fetch and extract content from a specific URL using Linkup API. Returns clean markdown content. Use for reading documentation, articles, or any specific webpage.",
  promptSnippet: "Fetch and read markdown content from a known URL.",
  promptGuidelines: [
    "Use this tool when the URL is already known and the goal is to read the page contents.",
    "Use this after search when you need to inspect a promising result in detail.",
    "Set renderJs to false for static documentation pages when speed matters.",
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

    return {
      content: [{ type: "text" as const, text: response.markdown }],
      details: { url: params.url, markdown: response.markdown },
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
      const remaining = Math.max(lines.length - COLLAPSED_PREVIEW_LINES, 0);

      container.addChild(
        new Markdown(visibleText, 0, 0, getMarkdownTheme(), {
          color: (text: string) => theme.fg("toolOutput", text),
        }),
      );

      if (remaining > 0) {
        container.addChild(
          new Text(
            theme.fg(
              "muted",
              `... (${remaining} more lines, ${keyHint("app.tools.expand", "to expand")})`,
            ),
            0,
            0,
          ),
        );
      }
    } else {
      container.addChild(
        new Markdown(markdownText, 0, 0, getMarkdownTheme(), {
          color: (text: string) => theme.fg("toolOutput", text),
        }),
      );
    }

    container.addChild(new Text("", 0, 0));
    container.addChild(
      new ToolFooter(theme, {
        items: [{ label: "url", value: details.url || "unknown" }],
        separator: " | ",
      }),
    );

    return container;
  },
  // biome-ignore lint/suspicious/noExplicitAny: Type safety provided by registerTool call
} as any;

export function registerWebFetchTool(pi: ExtensionAPI) {
  pi.registerTool(webFetchTool);
}
