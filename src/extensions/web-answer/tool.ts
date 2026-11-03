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
import { getClient, SearchDepth, searchFilters } from "../../client";
import {
  previewContent,
  structuredContent,
  structuredOutputSchema,
} from "../../lib/output";
import { linkupCostUsage, searchCost } from "../../lib/usage";
import { type LinkupSource, linkupSourceSchema } from "../../types";

interface WebAnswerSourceDetails extends LinkupSource {
  snippetTruncated?: boolean;
  snippetTempFilePath?: string;
  snippetTotalLines?: number;
  snippetTotalBytes?: number;
}

interface WebAnswerDetails {
  answer?: string;
  sources?: WebAnswerSourceDetails[];
  query?: string;
  answerTruncated?: boolean;
  answerTempFilePath?: string;
  answerTotalLines?: number;
  answerTotalBytes?: number;
}

const parameters = Type.Object({
  query: Type.String({
    description:
      "The question to answer. Be specific and detailed for best results.",
  }),
  depth: Type.Optional(SearchDepth),
  ...searchFilters.properties,
  includeInlineCitations: Type.Optional(
    Type.Boolean({
      description: "Include inline citations in the answer. Default: false.",
    }),
  ),
});

type WebAnswerParams = Static<typeof parameters>;

function indentMultiline(text: string, prefix: string) {
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

export const webAnswerTool = defineTool({
  name: "linkup_web_answer",
  label: "Linkup Web Answer",
  description:
    "Get a synthesized answer to a question using Linkup API. Returns a direct answer with sources in a preview capped at 2000 lines / 50KB; full blocks are saved to private temp files when truncated. Use when you need a concise answer to a specific question.",
  promptSnippet: "Answer a question with cited web sources.",
  promptGuidelines: [
    "Use linkup_web_answer when the user wants a direct answer with cited sources rather than exploratory browsing.",
    "Prefer linkup_web_answer over linkup_web_search when the goal is a concise answer, not source discovery.",
    "Use deeper search depth for linkup_web_answer for more complex or high-stakes questions.",
  ],
  parameters,
  annotations: { readOnlyHint: true, openWorldHint: true },
  outputSchema: structuredOutputSchema(
    Type.Object({
      query: Type.String(),
      answer: Type.String(),
      sources: Type.Array(linkupSourceSchema),
    }),
  ),

  async execute(
    _toolCallId: string,
    params: WebAnswerParams,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<WebAnswerDetails> | undefined,
    _ctx: ExtensionContext,
  ) {
    const client = await getClient();

    onUpdate?.({
      content: [
        {
          type: "text" as const,
          text: `Searching for answer${params.depth && params.depth !== "standard" ? ` (${params.depth} mode)` : ""}...`,
        },
      ],
      details: {},
    });

    const response = await client.search({
      query: params.query,
      depth: params.depth ?? "standard",
      includeDomains: params.includeDomains,
      excludeDomains: params.excludeDomains,
      fromDate: params.fromDate,
      toDate: params.toDate,
      outputType: "sourcedAnswer",
      includeInlineCitations: params.includeInlineCitations,
      signal,
    });

    const blockCount = response.sources.length + 1;
    const maxLines = Math.max(4, Math.floor(DEFAULT_MAX_LINES / blockCount));
    const maxBytes = Math.max(256, Math.floor(DEFAULT_MAX_BYTES / blockCount));
    const answerPreview = await previewContent(
      response.answer,
      maxLines,
      maxBytes,
    );
    const sources: WebAnswerSourceDetails[] = [];

    let content = `${answerPreview.preview}\n\n`;
    content += "Sources:\n";
    for (const source of response.sources) {
      content += `- ${source.name}: ${source.url}\n`;

      if (source.snippet) {
        const snippetPreview = await previewContent(
          source.snippet,
          maxLines,
          maxBytes,
        );
        content += `${indentMultiline(snippetPreview.preview, "  ")}\n`;
        sources.push({
          name: source.name,
          url: source.url,
          snippet: snippetPreview.preview,
          snippetTruncated: snippetPreview.truncated,
          snippetTempFilePath: snippetPreview.tempFilePath,
          snippetTotalLines: snippetPreview.totalLines,
          snippetTotalBytes: snippetPreview.totalBytes,
        });
      } else {
        sources.push({
          name: source.name,
          url: source.url,
        });
      }
    }

    const preview = await previewContent(content);
    return {
      content: [{ type: "text" as const, text: preview.preview }],
      details: {
        answer: answerPreview.preview,
        sources,
        query: params.query,
        answerTruncated: answerPreview.truncated,
        answerTempFilePath: answerPreview.tempFilePath,
        answerTotalLines: answerPreview.totalLines,
        answerTotalBytes: answerPreview.totalBytes,
      },
      usage: linkupCostUsage(
        searchCost(params.depth ?? "standard", "sourcedAnswer"),
      ),
      structuredContent: await structuredContent({
        query: params.query,
        answer: response.answer,
        sources: response.sources,
      }),
    };
  },

  renderCall(args: WebAnswerParams, theme: Theme) {
    const optionArgs = [];
    if (args.depth && args.depth !== "standard") {
      optionArgs.push({ label: "depth", value: args.depth });
    }

    return new ToolCallHeader(
      {
        toolName: "Linkup: WebAnswer",
        mainArg: `"${args.query}"`,
        showColon: true,
        optionArgs,
      },
      theme,
    );
  },

  renderResult(
    result: AgentToolResult<WebAnswerDetails>,
    options: ToolRenderResultOptions,
    theme: Theme,
    context,
  ) {
    const { expanded, isPartial } = options;
    const keyHint = context.keyHint ?? defaultKeyHint;

    if (isPartial) {
      return new Text(
        theme.fg("muted", "Linkup: WebAnswer: fetching..."),
        0,
        0,
      );
    }

    const details = result.details;
    const container = new Container();

    if (context.isError) {
      const textBlock = result.content.find((c) => c.type === "text");
      const errorMsg =
        (textBlock?.type === "text" && textBlock.text) || "Search failed";
      container.addChild(new Text(theme.fg("error", errorMsg), 0, 0));
      return container;
    }

    const answer = details?.answer ?? "";
    const sources = details.sources || [];

    if (!expanded) {
      // Collapsed: answer preview + source count
      let text = theme.fg("success", "Answer received");
      const preview = answer.slice(0, 100);
      text += `\n  ${theme.fg("muted", preview)}`;
      if (answer.length > 100) {
        text += theme.fg("dim", "...");
      }
      text += `\n  ${theme.fg("dim", `${sources.length} source(s)`)}`;
      text += theme.fg("muted", ` ${keyHint("app.tools.expand", "to expand")}`);
      container.addChild(new Text(text, 0, 0));
    } else {
      // Expanded: full answer + sources
      container.addChild(
        new Text(theme.fg("success", "Answer received"), 0, 0),
      );
      container.addChild(new Text("", 0, 0));
      container.addChild(
        new Markdown(answer, 0, 0, getMarkdownTheme(), {
          color: (text: string) => theme.fg("toolOutput", text),
        }),
      );
      if (details.answerTruncated && details.answerTempFilePath) {
        container.addChild(
          new Text(
            theme.fg(
              "warning",
              `Answer truncated. Full content: ${details.answerTempFilePath}`,
            ),
            0,
            0,
          ),
        );
      }

      if (sources.length > 0) {
        container.addChild(new Text("", 0, 0));
        container.addChild(
          new Text(theme.fg("accent", theme.bold("Sources")), 0, 0),
        );

        for (const source of sources) {
          container.addChild(new Text("", 0, 0));
          container.addChild(
            new Text(
              `${theme.fg("dim", ">")} ${theme.fg("accent", theme.bold(source.name))}`,
              0,
              0,
            ),
          );
          container.addChild(
            new Text(`  ${theme.fg("dim", source.url)}`, 0, 0),
          );
          if (source.snippet) {
            container.addChild(new Text("", 0, 0));
            const snippet = source.snippet
              .split("\n")
              .slice(0, 3)
              .map((line) => `> ${line}`)
              .join("\n");
            container.addChild(
              new Markdown(snippet, 0, 0, getMarkdownTheme(), {
                color: (text: string) => theme.fg("toolOutput", text),
              }),
            );
            if (source.snippetTruncated && source.snippetTempFilePath) {
              container.addChild(
                new Text(
                  theme.fg(
                    "warning",
                    `Source snippet truncated. Full content: ${source.snippetTempFilePath}`,
                  ),
                  0,
                  0,
                ),
              );
            }
          }
        }
      }
    }

    container.addChild(new Text("", 0, 0));
    container.addChild(
      new ToolFooter(theme, {
        items: [{ label: "sources", value: `${sources.length} source(s)` }],
        separator: " | ",
      }),
    );

    return container;
  },
});
