import type {
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import { getClient } from "../client";

interface WebFetchDetails {
  url?: string;
  markdown?: string;
  error?: string;
  isError?: boolean;
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

export const webFetchTool = {
  name: "linkup_web_fetch",
  label: "Linkup Web Fetch",
  description:
    "Fetch and extract content from a specific URL using Linkup API. Returns clean markdown content. Use for reading documentation, articles, or any specific webpage.",
  parameters,

  async execute(
    _toolCallId: string,
    params: Static<typeof parameters>,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<WebFetchDetails> | undefined,
    _ctx: ExtensionContext,
  ) {
    const client = getClient();

    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        details: { error: message, url: params.url, isError: true },
      };
    }
  },

  // biome-ignore lint/suspicious/noExplicitAny: Theme type comes from pi-coding-agent
  renderCall(args: Static<typeof parameters>, theme: any) {
    let text = theme.fg("toolTitle", theme.bold("Linkup: WebFetch "));
    text += theme.fg("accent", args.url);
    if (args.renderJs === false) {
      text += theme.fg("dim", " (no JS)");
    }
    return new Text(text, 0, 0);
  },

  // biome-ignore lint/suspicious/noExplicitAny: ToolResult and Theme types come from pi-coding-agent
  renderResult(result: any, { expanded, isPartial }: any, theme: any) {
    if (isPartial) {
      const text =
        result.content?.[0]?.type === "text"
          ? result.content[0].text
          : "Fetching...";
      return new Text(theme.fg("dim", text), 0, 0);
    }

    const details = result.details as WebFetchDetails;

    if (details?.isError) {
      const errorMsg =
        result.content?.[0]?.type === "text"
          ? result.content[0].text
          : "Error occurred";
      return new Text(theme.fg("error", errorMsg), 0, 0);
    }

    const markdown = details?.markdown || "";
    const url = details?.url || "";

    let text = theme.fg("success", "✓ Fetched");
    text += ` ${theme.fg("dim", url)}`;

    if (!expanded) {
      const preview = markdown.slice(0, 100).replace(/\n/g, " ");
      text += `\n  ${theme.fg("muted", preview)}`;
      if (markdown.length > 100) {
        text += theme.fg("dim", "...");
      }
      text += theme.fg("muted", ` [Ctrl+O to expand]`);
    }

    if (expanded) {
      const lines = markdown.split("\n");
      const previewLines = lines.slice(0, 50);
      text += `\n\n${previewLines.join("\n")}`;
      if (lines.length > 50) {
        text += `\n${theme.fg("dim", `\n[${lines.length - 50} more lines...]`)}`;
      }
    }

    return new Text(text, 0, 0);
  },
  // biome-ignore lint/suspicious/noExplicitAny: Type safety provided by registerTool call
} as any;

export function registerWebFetchTool(pi: ExtensionAPI) {
  pi.registerTool(webFetchTool);
}
