import { ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  keyHint as defaultKeyHint,
  defineTool,
  getMarkdownTheme,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "typebox";
import { getClient, SearchDepth, type SearchDepthType } from "../../client";
import {
  previewContent,
  structuredContent,
  structuredOutputSchema,
} from "../../lib/output";
import {
  type LinkupSearchResponse,
  linkupSearchResultSchema,
} from "../../types";

interface WebSearchResultDetails {
  name: string;
  url: string;
  preview?: string;
  truncated: boolean;
  tempFilePath?: string;
  totalLines: number;
  totalBytes: number;
}

interface WebSearchDetails {
  results?: WebSearchResultDetails[];
  query?: string;
}

const parameters = Type.Object({
  query: Type.String({
    description: "The search query. Be specific and detailed for best results.",
  }),
  depth: Type.Optional(SearchDepth),
  limit: Type.Optional(
    Type.Integer({
      minimum: 1,
      description:
        "Maximum number of results to return. Defaults to 10. Use fewer (3-5) for focused lookups, more (10-15) for broad research.",
    }),
  ),
});

type WebSearchParams = Static<typeof parameters>;

export const webSearchTool = defineTool({
  name: "linkup_web_search",
  label: "Linkup Web Search",
  description:
    "Search the web using Linkup API. Returns relevant sources with content snippets in a preview capped at 2000 lines / 50KB (default: 10 results max); full output is saved to a private temp file when truncated. Use `limit` to control how many results are returned.",
  promptSnippet: "Search the web for sources, documentation, and articles.",
  promptGuidelines: [
    "Use linkup_web_search to discover sources across the web before fetching a specific page.",
    "Use `limit` on linkup_web_search to control result count: 3-5 for quick lookups, 10 (default) for general research, up to 15 for broad surveys.",
    "Use fast for quick factual lookups, standard for balanced research, and deep for complex multi-source research.",
    "Write specific queries with names, dates, versions, or locations for linkup_web_search.",
    "Prefer linkup_web_search when the user asks for research, source discovery, or finding relevant pages.",
  ],
  parameters,
  annotations: { readOnlyHint: true, openWorldHint: true },
  outputSchema: structuredOutputSchema(
    Type.Object({
      query: Type.String(),
      results: Type.Array(linkupSearchResultSchema),
    }),
  ),

  async execute(
    _toolCallId: string,
    params: WebSearchParams,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<WebSearchDetails> | undefined,
    _ctx: ExtensionContext,
  ) {
    const client = getClient();

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
      maxResults: params.limit ?? 10,
      signal,
    })) as LinkupSearchResponse;

    let content = `Found ${response.results.length} result(s):\n\n`;
    const results: WebSearchResultDetails[] = [];

    for (const result of response.results) {
      content += `## ${result.name}\n`;
      content += `URL: ${result.url}\n`;

      if (result.content) {
        const preview = await previewContent(
          result.content,
          Math.max(4, Math.floor(DEFAULT_MAX_LINES / response.results.length)),
          Math.max(
            256,
            Math.floor(DEFAULT_MAX_BYTES / response.results.length),
          ),
        );
        content += `\n${preview.preview}\n`;
        results.push({
          name: result.name,
          url: result.url,
          preview: preview.preview,
          truncated: preview.truncated,
          tempFilePath: preview.tempFilePath,
          totalLines: preview.totalLines,
          totalBytes: preview.totalBytes,
        });
      } else {
        results.push({
          name: result.name,
          url: result.url,
          truncated: false,
          totalLines: 0,
          totalBytes: 0,
        });
      }

      content += "\n---\n\n";
    }

    const preview = await previewContent(content);
    return {
      content: [{ type: "text" as const, text: preview.preview }],
      details: { results, query: params.query },
      structuredContent: await structuredContent({
        query: params.query,
        results: response.results,
      }),
    };
  },

  renderCall(args: WebSearchParams, theme: Theme) {
    const optionArgs = [];
    if (args.depth && args.depth !== "standard") {
      optionArgs.push({ label: "depth", value: args.depth });
    }
    if (args.limit !== undefined) {
      optionArgs.push({ label: "limit", value: String(args.limit) });
    }

    return new ToolCallHeader(
      {
        toolName: "Linkup: WebSearch",
        mainArg: `"${args.query}"`,
        showColon: true,
        optionArgs,
      },
      theme,
    );
  },

  renderResult(
    result: AgentToolResult<WebSearchDetails>,
    options: ToolRenderResultOptions,
    theme: Theme,
    context,
  ) {
    const { expanded, isPartial } = options;
    const keyHint = context.keyHint ?? defaultKeyHint;
    const SNIPPET_LINES = 5;

    if (isPartial) {
      return new Text(
        theme.fg("muted", "Linkup: WebSearch: fetching..."),
        0,
        0,
      );
    }

    const details = result.details;
    const results = details?.results || [];
    const container = new Container();

    if (context.isError) {
      const textBlock = result.content.find((c) => c.type === "text");
      const errorMsg =
        (textBlock?.type === "text" && textBlock.text) || "Search failed";
      container.addChild(new Text(theme.fg("error", errorMsg), 0, 0));
      return container;
    }

    if (results.length === 0) {
      container.addChild(
        new Text(theme.fg("muted", "Linkup: WebSearch: no results"), 0, 0),
      );
    } else if (!expanded) {
      // Collapsed: show first result title
      const first = results[0];
      if (first) {
        let text = `  ${theme.fg("dim", first.name)}`;
        if (results.length > 1) {
          text += theme.fg("dim", ` (+${results.length - 1} more)`);
        }
        container.addChild(new Text(text, 0, 0));
      }
    } else {
      // Expanded: show each result with title, URL, and snippet
      for (const r of results) {
        container.addChild(new Text("", 0, 0));
        container.addChild(
          new Text(
            `${theme.fg("dim", ">")} ${theme.fg("accent", theme.bold(r.name))}`,
            0,
            0,
          ),
        );
        container.addChild(new Text(`  ${theme.fg("dim", r.url)}`, 0, 0));

        if (r.preview) {
          container.addChild(new Text("", 0, 0));
          const snippet = r.preview
            .split("\n")
            .slice(0, SNIPPET_LINES)
            .map((line) => `> ${line}`)
            .join("\n");
          container.addChild(
            new Markdown(snippet, 0, 0, getMarkdownTheme(), {
              color: (text: string) => theme.fg("toolOutput", text),
            }),
          );
          if (r.truncated && r.tempFilePath) {
            container.addChild(
              new Text(
                theme.fg(
                  "warning",
                  `Result truncated. Full content: ${r.tempFilePath}`,
                ),
                0,
                0,
              ),
            );
          }
        }
      }
    }

    const footerItems = [
      { label: "", value: `Found ${results.length} result(s)` },
    ];
    if (!expanded && results.length > 0) {
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
