import type {
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import { getClient, SearchDepth, type SearchDepthType } from "../client";
import type { LinkupSource, LinkupSourcedAnswerResponse } from "../types";

interface WebAnswerDetails {
  answer?: string;
  sources?: LinkupSource[];
  query?: string;
  error?: string;
  isError?: boolean;
}

const parameters = Type.Object({
  query: Type.String({
    description:
      "The question to answer. Be specific and detailed for best results.",
  }),
  depth: Type.Optional(SearchDepth),
});

export const webAnswerTool = {
  name: "linkup_web_answer",
  label: "Linkup Web Answer",
  description:
    "Get a synthesized answer to a question using Linkup API. Returns a direct answer with sources. Use when you need a concise answer to a specific question.",
  parameters,

  async execute(
    _toolCallId: string,
    params: Static<typeof parameters>,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback<WebAnswerDetails> | undefined,
    _ctx: ExtensionContext,
  ) {
    const client = getClient();

    try {
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

      let content = `${response.answer}\n\n`;
      content += `Sources:\n`;
      for (const source of response.sources) {
        content += `- ${source.name}: ${source.url}\n`;
        if (source.snippet) {
          content += `  ${source.snippet}\n`;
        }
      }

      return {
        content: [{ type: "text" as const, text: content }],
        details: {
          answer: response.answer,
          sources: response.sources,
          query: params.query,
        },
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
    let text = theme.fg("toolTitle", theme.bold("Linkup: WebAnswer "));
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

    const details = result.details as WebAnswerDetails;

    if (details?.isError) {
      const errorMsg =
        result.content?.[0]?.type === "text"
          ? result.content[0].text
          : "Error occurred";
      return new Text(theme.fg("error", errorMsg), 0, 0);
    }

    const answer = details?.answer || "";
    const sources = details?.sources || [];

    let text = theme.fg("success", "✓ Answer received");

    if (!expanded) {
      const preview = answer.slice(0, 100);
      text += `\n  ${theme.fg("muted", preview)}`;
      if (answer.length > 100) {
        text += theme.fg("dim", "...");
      }
      text += `\n  ${theme.fg("dim", `${sources.length} source(s)`)}`;
      text += theme.fg("muted", ` [Ctrl+O to expand]`);
    }

    if (expanded) {
      text += `\n\n${theme.fg("accent", "Answer:")}`;
      text += `\n${answer}`;

      if (sources.length > 0) {
        text += `\n\n${theme.fg("accent", "Sources:")}`;
        for (const source of sources) {
          text += `\n• ${theme.bold(source.name)}`;
          text += `\n  ${theme.fg("dim", source.url)}`;
          if (source.snippet) {
            text += `\n  ${theme.fg("muted", source.snippet)}`;
          }
        }
      }
    }

    return new Text(text, 0, 0);
  },
  // biome-ignore lint/suspicious/noExplicitAny: Type safety provided by registerTool call
} as any;

export function registerWebAnswerTool(pi: ExtensionAPI) {
  pi.registerTool(webAnswerTool);
}
