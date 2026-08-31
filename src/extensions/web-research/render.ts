import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ToolFooter } from "@aliou/pi-utils-ui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  getMarkdownTheme,
  keyHint,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import type { LinkupResearchSourcedAnswer, LinkupSource } from "../../types";

export interface ResearchSourceDetails extends LinkupSource {
  snippetTruncated?: boolean;
  snippetTempFilePath?: string;
  snippetTotalLines?: number;
  snippetTotalBytes?: number;
}

export interface ResearchResultDetails {
  taskId?: string;
  query?: string;
  status?: string;
  elapsedSeconds?: number;
  answer?: string;
  answerTruncated?: boolean;
  answerTempFilePath?: string;
  answerTotalLines?: number;
  answerTotalBytes?: number;
  sources?: ResearchSourceDetails[];
}

export interface PerResultPreview {
  preview: string;
  tempFilePath?: string;
  truncated: boolean;
  totalLines: number;
  totalBytes: number;
}

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
    .map((line: string) => `${prefix}${line}`)
    .join("\n");
}

export interface FormattedResearchResult {
  text: string;
  details: ResearchResultDetails;
}

/**
 * Format a completed sourced answer as markdown text (LLM context) plus
 * structured details for rendering. Oversized answers/snippets are
 * truncated and dumped to temp files for on-demand retrieval.
 */
export async function buildResearchResult(
  query: string | undefined,
  taskId: string,
  elapsedSeconds: number,
  output: LinkupResearchSourcedAnswer,
): Promise<FormattedResearchResult> {
  const answerPreview = await writePerResultPreview(output.answer, "answer");
  const sources: ResearchSourceDetails[] = [];

  let text = `${answerPreview.preview}\n\n`;
  text += "Sources:\n";
  for (const [index, source] of (output.sources ?? []).entries()) {
    text += `- ${source.name}: ${source.url}\n`;

    if (source.snippet) {
      const snippetPreview = await writePerResultPreview(
        source.snippet,
        `source-${index + 1}`,
      );
      text += `${indentMultiline(snippetPreview.preview, "  ")}\n`;
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
    text,
    details: {
      taskId,
      query,
      status: "completed",
      elapsedSeconds,
      answer: answerPreview.preview,
      answerTruncated: answerPreview.truncated,
      answerTempFilePath: answerPreview.tempFilePath,
      answerTotalLines: answerPreview.totalLines,
      answerTotalBytes: answerPreview.totalBytes,
      sources,
    },
  };
}

/**
 * Render a completed research result (used for the status tool's result
 * slot and expanded custom messages).
 */
export function renderResearchResultContainer(
  details: ResearchResultDetails,
  options: { expanded: boolean },
  theme: Theme,
): Container {
  const { expanded } = options;
  const container = new Container();
  const answer = details.answer ?? "";
  const sources = details.sources || [];

  const header = `Research completed${details.elapsedSeconds !== undefined ? ` in ${details.elapsedSeconds}s` : ""}${details.taskId ? ` (${details.taskId})` : ""}`;

  if (!expanded) {
    let text = theme.fg("success", header);
    const preview = answer.slice(0, 100);
    text += `\n  ${theme.fg("muted", preview)}`;
    if (answer.length > 100) {
      text += theme.fg("dim", "...");
    }
    text += `\n  ${theme.fg("dim", `${sources.length} source(s)`)}`;
    text += theme.fg("muted", ` ${keyHint("app.tools.expand", "to expand")}`);
    container.addChild(new Text(text, 0, 0));
  } else {
    container.addChild(new Text(theme.fg("success", header), 0, 0));
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
        container.addChild(new Text(`  ${theme.fg("dim", source.url)}`, 0, 0));
        if (source.snippet) {
          container.addChild(new Text("", 0, 0));
          const snippet = source.snippet
            .split("\n")
            .slice(0, 3)
            .map((line: string) => `> ${line}`)
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
    new ToolFooter(theme, { items: footerItems, separator: " | " }),
  );

  return container;
}

/** Renderer helper for tool results and messages that failed or have no answer. */
export function renderResearchError(
  container: Container,
  message: string,
  theme: Theme,
) {
  container.addChild(new Text(theme.fg("error", message), 0, 0));
  return container;
}
