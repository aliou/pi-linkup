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
} from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  getMarkdownTheme,
  keyHint,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import { getClient, SearchDepth, type SearchDepthType } from "../../client";
import type { LinkupSource, LinkupSourcedAnswerResponse } from "../../types";

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

interface PerResultPreview {
  preview: string;
  tempFilePath?: string;
  truncated: boolean;
  totalLines: number;
  totalBytes: number;
}

const parameters = Type.Object({
  query: Type.String({
    description:
      "The question to answer. Be specific and detailed for best results.",
  }),
  depth: Type.Optional(SearchDepth),
});

type WebAnswerParams = Static<typeof parameters>;

function slugifyTempName(slug: string) {
  return (
    slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "result"
  );
}

async function writePerResultPreview(
  content: string,
  slug: string,
  maxLines = DEFAULT_MAX_LINES,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<PerResultPreview> {
  const result = truncateHead(content, { maxLines, maxBytes });
  let preview = result.content;
  let tempFilePath: string | undefined;

  if (result.truncated) {
    tempFilePath = join(
      tmpdir(),
      `pi-linkup-answer-${slugifyTempName(slug)}-${randomBytes(4).toString("hex")}.md`,
    );
    await writeFile(tempFilePath, content, "utf8");
    preview += `\n\n[Result truncated: ${result.outputLines} of ${result.totalLines} lines (${formatSize(result.outputBytes)} of ${formatSize(result.totalBytes)}). Full result: ${tempFilePath}]`;
  }

  return {
    preview,
    tempFilePath,
    truncated: result.truncated,
    totalLines: result.totalLines,
    totalBytes: result.totalBytes,
  };
}

function indentMultiline(text: string, prefix: string) {
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

export const webAnswerTool = {
  name: "linkup_web_answer",
  label: "Linkup Web Answer",
  description:
    "Get a synthesized answer to a question using Linkup API. Returns a direct answer with sources. Use when you need a concise answer to a specific question.",
  promptSnippet: "Answer a question with cited web sources.",
  promptGuidelines: [
    "Use linkup_web_answer when the user wants a direct answer with cited sources rather than exploratory browsing.",
    "Prefer linkup_web_answer over linkup_web_search when the goal is a concise answer, not source discovery.",
    "Use deeper search depth for linkup_web_answer for more complex or high-stakes questions.",
  ],
  parameters,

  async execute(
    _toolCallId: string,
    params: WebAnswerParams,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<WebAnswerDetails> | undefined,
    _ctx: ExtensionContext,
  ) {
    const client = getClient();

    onUpdate?.({
      content: [
        {
          type: "text" as const,
          text: `Searching for answer${params.depth && params.depth !== "standard" ? ` (${params.depth} mode)` : ""}...`,
        },
      ],
      details: {},
    });

    const response = (await client.search({
      query: params.query,
      depth: (params.depth ?? "standard") as SearchDepthType,
      outputType: "sourcedAnswer",
      signal,
    })) as LinkupSourcedAnswerResponse;

    const answerPreview = await writePerResultPreview(
      response.answer,
      "answer",
    );
    const sources: WebAnswerSourceDetails[] = [];

    let content = `${answerPreview.preview}\n\n`;
    content += "Sources:\n";
    for (const [index, source] of response.sources.entries()) {
      content += `- ${source.name}: ${source.url}\n`;

      if (source.snippet) {
        const snippetPreview = await writePerResultPreview(
          source.snippet,
          `source-${index + 1}`,
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

    return {
      content: [{ type: "text" as const, text: content }],
      details: {
        answer: answerPreview.preview,
        sources,
        query: params.query,
        answerTruncated: answerPreview.truncated,
        answerTempFilePath: answerPreview.tempFilePath,
        answerTotalLines: answerPreview.totalLines,
        answerTotalBytes: answerPreview.totalBytes,
      },
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
  ) {
    const { expanded, isPartial } = options;

    if (isPartial) {
      return new Text(
        theme.fg("muted", "Linkup: WebAnswer: fetching..."),
        0,
        0,
      );
    }

    const details = result.details;
    const container = new Container();

    // When the tool throws, the framework calls renderResult with
    // details={} (empty object) and the error message in content.
    if (!details?.answer) {
      const textBlock = result.content.find((c) => c.type === "text");
      const errorMsg =
        (textBlock?.type === "text" && textBlock.text) || "Search failed";
      container.addChild(new Text(theme.fg("error", errorMsg), 0, 0));
      return container;
    }

    const answer = details.answer;
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
  // biome-ignore lint/suspicious/noExplicitAny: Type safety provided by registerTool call
} as any;
