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
import {
  getClient,
  ResearchMode,
  type ResearchModeType,
  ResearchReasoningDepth,
  type ResearchReasoningDepthType,
} from "../../client";
import type { LinkupResearchSourcedAnswer, LinkupSource } from "../../types";

interface ResearchSourceDetails extends LinkupSource {
  snippetTruncated?: boolean;
  snippetTempFilePath?: string;
  snippetTotalLines?: number;
  snippetTotalBytes?: number;
}

interface ResearchDetails {
  query?: string;
  answer?: string;
  answerTruncated?: boolean;
  answerTempFilePath?: string;
  answerTotalLines?: number;
  answerTotalBytes?: number;
  sources?: ResearchSourceDetails[];
  status?: string;
  elapsedSeconds?: number;
}

interface PerResultPreview {
  preview: string;
  tempFilePath?: string;
  truncated: boolean;
  totalLines: number;
  totalBytes: number;
}

// Polling defaults per Linkup docs: initial 2s interval, backoff doubling
// up to 10s, never faster than 1 request per second.
const INITIAL_POLL_INTERVAL_MS = 2000;
const MAX_POLL_INTERVAL_MS = 10000;

function slugifyTempName(slug: string) {
  return (
    slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "result"
  );
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
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
      `pi-linkup-research-${slugifyTempName(slug)}-${randomBytes(4).toString("hex")}.md`,
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

const parameters = Type.Object({
  query: Type.String({
    description:
      "The research question, phrased in natural language. Both terse and detailed inputs are accepted; more precise input (angles to cover, entities to compare, facts to verify, expected structure) produces more predictable, thorough, and aligned output.",
  }),
  mode: Type.Optional(ResearchMode),
  reasoningDepth: Type.Optional(ResearchReasoningDepth),
  includeDomains: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Restrict the research to trusted domains (up to 100). Improves quality and reduces latency when authoritative sources are known.",
    }),
  ),
  excludeDomains: Type.Optional(
    Type.Array(Type.String(), {
      description: "Domains to exclude from the research.",
    }),
  ),
  fromDate: Type.Optional(
    Type.String({
      description:
        "ISO 8601 date (YYYY-MM-DD). Restrict to results on or after this date. Prefer this over embedding dates in the question.",
    }),
  ),
  toDate: Type.Optional(
    Type.String({
      description:
        "ISO 8601 date (YYYY-MM-DD). Restrict to results on or before this date.",
    }),
  ),
});

type ResearchParams = Static<typeof parameters>;

export const webResearchTool = {
  name: "linkup_research",
  label: "Linkup Research",
  description:
    "Run an autonomous deep research task using the Linkup /research API and return the completed, sourced result. Use for questions a single search query cannot resolve: verified answers to precise questions, focused investigations of a defined subject, or broad multi-angle reports. Latency is 2-20 minutes depending on reasoningDepth; the tool polls until completion. Costs $0.25-$2.50 per call.",
  promptSnippet:
    "Run deep, multi-source research for questions single searches cannot resolve.",
  promptGuidelines: [
    "Use linkup_research only for questions that linkup_web_search or linkup_web_answer cannot resolve: multi-source synthesis, comparative analysis, or broad multi-angle reports.",
    "linkup_research is expensive ($0.25-$2.50) and slow (2-20 minutes); prefer linkup_web_search or linkup_web_answer for quick lookups.",
    "Set mode explicitly on linkup_research for predictable latency, cost, and output shape: answer for definitive questions, investigate for deep-dives on a single subject, research for broad multi-entity reports.",
    "Write detailed research briefs for linkup_research: angles to cover, entities to compare, facts to verify, and the expected output structure.",
    "Use reasoningDepth S or M for routine questions; reserve L (default) and XL for high-stakes deliverables.",
  ],
  parameters,

  async execute(
    _toolCallId: string,
    params: ResearchParams,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<ResearchDetails> | undefined,
    _ctx: ExtensionContext,
  ) {
    const client = getClient();
    const startedAt = Date.now();

    const elapsed = () => Math.round((Date.now() - startedAt) / 1000);

    onUpdate?.({
      content: [
        {
          type: "text" as const,
          text: "Submitting research task...",
        },
      ],
      details: { query: params.query, status: "submitting" },
    });

    const task = await client.createResearch({
      query: params.query,
      mode: params.mode as ResearchModeType | undefined,
      reasoningDepth: params.reasoningDepth as
        | ResearchReasoningDepthType
        | undefined,
      outputType: "sourcedAnswer",
      includeDomains: params.includeDomains,
      excludeDomains: params.excludeDomains,
      fromDate: params.fromDate,
      toDate: params.toDate,
      signal,
    });

    // Poll with backoff until the task completes or fails.
    let intervalMs = INITIAL_POLL_INTERVAL_MS;
    let current = task;

    while (current.status !== "completed" && current.status !== "failed") {
      await sleep(intervalMs, signal);
      intervalMs = Math.min(intervalMs * 2, MAX_POLL_INTERVAL_MS);

      current = await client.getResearch(task.id, signal);

      onUpdate?.({
        content: [
          {
            type: "text" as const,
            text: `Researching (${current.status}, ${elapsed()}s elapsed)...`,
          },
        ],
        details: {
          query: params.query,
          status: current.status,
          elapsedSeconds: elapsed(),
        },
      });
    }

    if (current.status === "failed") {
      throw new Error(
        current.error ||
          `Research task ${task.id} failed without an error message`,
      );
    }

    const output = current.output as LinkupResearchSourcedAnswer | undefined;
    if (!output || typeof output !== "object" || !("answer" in output)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Research completed in ${elapsed()}s, but returned no output.\n\n${JSON.stringify(current.output, null, 2)}`,
          },
        ],
        details: {
          query: params.query,
          status: current.status,
          elapsedSeconds: elapsed(),
        },
      };
    }

    const answerPreview = await writePerResultPreview(output.answer, "answer");
    const sources: ResearchSourceDetails[] = [];

    let content = `${answerPreview.preview}\n\n`;
    content += "Sources:\n";
    for (const [index, source] of (output.sources ?? []).entries()) {
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
        query: params.query,
        answer: answerPreview.preview,
        answerTruncated: answerPreview.truncated,
        answerTempFilePath: answerPreview.tempFilePath,
        answerTotalLines: answerPreview.totalLines,
        answerTotalBytes: answerPreview.totalBytes,
        sources,
        status: current.status,
        elapsedSeconds: elapsed(),
      },
    };
  },

  renderCall(args: ResearchParams, theme: Theme) {
    const optionArgs = [];
    if (args.mode) {
      optionArgs.push({ label: "mode", value: args.mode });
    }
    if (args.reasoningDepth) {
      optionArgs.push({ label: "depth", value: args.reasoningDepth });
    }

    return new ToolCallHeader(
      {
        toolName: "Linkup: Research",
        mainArg: `"${args.query}"`,
        showColon: true,
        optionArgs,
      },
      theme,
    );
  },

  renderResult(
    result: AgentToolResult<ResearchDetails>,
    options: ToolRenderResultOptions,
    theme: Theme,
  ) {
    const { expanded, isPartial } = options;

    if (isPartial) {
      const details = result.details;
      let text = "Linkup: Research: running...";
      if (details?.status) {
        text = `Linkup: Research: ${details.status}`;
        if (details.elapsedSeconds !== undefined) {
          text += ` (${details.elapsedSeconds}s)`;
        }
      }
      return new Text(theme.fg("muted", text), 0, 0);
    }

    const details = result.details;
    const container = new Container();

    // When the tool throws, the framework calls renderResult with
    // details={} (empty object) and the error message in content.
    if (!details?.answer) {
      const textBlock = result.content.find((c) => c.type === "text");
      const errorMsg =
        (textBlock?.type === "text" && textBlock.text) || "Research failed";
      container.addChild(new Text(theme.fg("error", errorMsg), 0, 0));
      return container;
    }

    const answer = details.answer;
    const sources = details.sources || [];

    if (!expanded) {
      // Collapsed: answer preview + source count
      let text = theme.fg(
        "success",
        `Research completed${details.elapsedSeconds !== undefined ? ` in ${details.elapsedSeconds}s` : ""}`,
      );
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
        new Text(
          theme.fg(
            "success",
            `Research completed${details.elapsedSeconds !== undefined ? ` in ${details.elapsedSeconds}s` : ""}`,
          ),
          0,
          0,
        ),
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

    const footerItems = [
      { label: "sources", value: `${sources.length} source(s)` },
    ];
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
