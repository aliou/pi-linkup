import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { getClient, SearchDepth, type SearchDepthType } from "../client";
import type { LinkupSearchResponse, LinkupSearchResult } from "../types";

interface WebSearchDetails {
  results?: LinkupSearchResult[];
  query?: string;
  error?: string;
  isError?: boolean;
}

export function registerWebSearchTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "linkup_web_search",
    label: "Linkup Web Search",
    description:
      "Search the web using Linkup API. Returns a list of relevant sources with content snippets. Use for finding information, documentation, articles, or any web content.",
    parameters: Type.Object({
      query: Type.String({
        description:
          "The search query. Be specific and detailed for best results.",
      }),
      depth: Type.Optional(SearchDepth),
    }),

    async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
      const client = getClient();

      try {
        onUpdate?.({
          content: [
            {
              type: "text",
              text: `Searching${params.depth && params.depth !== "standard" ? ` (${params.depth} mode)` : ""}...`,
            },
          ],
          details: {},
        });

        const response = (await client.search({
          query: params.query,
          depth: (params.depth ?? "standard") as SearchDepthType,
          outputType: "searchResults",
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
          content: [{ type: "text", text: content }],
          details: { results: response.results, query: params.query },
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          details: { error: message, isError: true },
        };
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("Linkup: WebSearch "));
      text += theme.fg("accent", `"${args.query}"`);
      if (args.depth && args.depth !== "standard") {
        text += theme.fg("dim", ` (${args.depth})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded, isPartial }, theme) {
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
  });
}
