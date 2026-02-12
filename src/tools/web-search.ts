import type {
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import { getClient, SearchDepth, type SearchDepthType } from "../client";
import type { LinkupSearchResponse, LinkupSearchResult } from "../types";

interface WebSearchDetails {
  results?: LinkupSearchResult[];
  query?: string;
  error?: string;
  isError?: boolean;
}

const parameters = Type.Object({
  query: Type.String({
    description: "The search query. Be specific and detailed for best results.",
  }),
  depth: Type.Optional(SearchDepth),
});

export const webSearchTool = {
  name: "linkup_web_search",
  label: "Linkup Web Search",
  description:
    "Search the web using Linkup API. Returns a list of relevant sources with content snippets. Use for finding information, documentation, articles, or any web content.",
  parameters,

  async execute(
    _toolCallId: string,
    params: Static<typeof parameters>,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<WebSearchDetails> | undefined,
    _ctx: ExtensionContext,
  ) {
    const client = getClient();

    try {
      onUpdate?.({
        content: [
          {
            type: "text" as const,
            text: `Searching${params.depth && params.depth !== "standard" ? ` (${params.depth} mode)` : ""}...`,
          },
        ],
        details: {},
      });

      const response = (await client.search({
        query: params.query,
        depth: (params.depth ?? "standard") as SearchDepthType,
        outputType: "searchResults",
        signal,
      })) as LinkupSearchResponse;

      let content = `Found ${response.results.length} result(s):\n\n`;
      for (const result of response.results) {
        content += `## ${result.name}\n`;
        content += `URL: ${result.url}\n`;
        if (result.content) {
          content += `\n${result.content}\n`;
        }
        content += "\n---\n\n";
      }

      return {
        content: [{ type: "text" as const, text: content }],
        details: { results: response.results, query: params.query },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        details: { error: message, isError: true },
      };
    }
  },

  // biome-ignore lint/suspicious/noExplicitAny: Theme type comes from pi-coding-agent
  renderCall(args: Static<typeof parameters>, theme: any) {
    let text = theme.fg("toolTitle", theme.bold("Linkup: WebSearch "));
    text += theme.fg("accent", `"${args.query}"`);
    if (args.depth && args.depth !== "standard") {
      text += theme.fg("dim", ` (${args.depth})`);
    }
    return new Text(text, 0, 0);
  },

  // biome-ignore lint/suspicious/noExplicitAny: ToolResult and Theme types come from pi-coding-agent
  renderResult(result: any, { expanded, isPartial }: any, theme: any) {
    if (isPartial) {
      const text =
        result.content?.[0]?.type === "text"
          ? result.content[0].text
          : "Searching...";
      return new Text(theme.fg("dim", text), 0, 0);
    }

    const details = result.details as WebSearchDetails;

    if (details?.isError) {
      const errorMsg =
        result.content?.[0]?.type === "text"
          ? result.content[0].text
          : "Error occurred";
      return new Text(theme.fg("error", errorMsg), 0, 0);
    }

    const results = details?.results || [];
    let text = theme.fg("success", `✓ Found ${results.length} result(s)`);

    if (!expanded && results.length > 0) {
      const first = results[0];
      text += `\n  ${theme.fg("dim", `${first.name}`)}`;
      if (results.length > 1) {
        text += theme.fg("dim", ` (${results.length - 1} more)`);
      }
      text += theme.fg("muted", ` [Ctrl+O to expand]`);
    }

    if (expanded) {
      for (const r of results) {
        text += `\n\n${theme.fg("accent", theme.bold(r.name))}`;
        text += `\n${theme.fg("dim", r.url)}`;
        if (r.content) {
          const preview = r.content.slice(0, 200);
          text += `\n${theme.fg("muted", preview)}`;
          if (r.content.length > 200) {
            text += theme.fg("dim", "...");
          }
        }
      }
    }

    return new Text(text, 0, 0);
  },
  // biome-ignore lint/suspicious/noExplicitAny: Type safety provided by registerTool call
} as any;

export function registerWebSearchTool(pi: ExtensionAPI) {
  pi.registerTool(webSearchTool);
}
