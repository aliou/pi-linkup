import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { getClient } from "../client";
import type { LinkupSource, LinkupSourcedAnswerResponse } from "../types";

interface WebAnswerDetails {
  answer?: string;
  sources?: LinkupSource[];
  query?: string;
  error?: string;
  isError?: boolean;
}

export function registerWebAnswerTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "linkup_web_answer",
    label: "Linkup Web Answer",
    description:
      "Get a synthesized answer to a question using Linkup API. Returns a direct answer with sources. Use when you need a concise answer to a specific question.",
    parameters: Type.Object({
      query: Type.String({
        description:
          "The question to answer. Be specific and detailed for best results.",
      }),
      deep: Type.Optional(
        Type.Boolean({
          description:
            "Use deep search for more comprehensive answer (slower). Default: false (standard search).",
        }),
      ),
    }),

    async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
      const client = getClient();

      try {
        onUpdate?.({
          content: [
            {
              type: "text",
              text: `Searching for answer${params.deep ? " (deep mode)" : ""}...`,
            },
          ],
          details: {},
        });

        const response = (await client.search({
          query: params.query,
          depth: params.deep ? "deep" : "standard",
          outputType: "sourcedAnswer",
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
          content: [{ type: "text", text: content }],
          details: {
            answer: response.answer,
            sources: response.sources,
            query: params.query,
          },
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
      let text = theme.fg("toolTitle", theme.bold("Linkup: WebAnswer "));
      text += theme.fg("accent", `"${args.query}"`);
      if (args.deep) {
        text += theme.fg("dim", " (deep)");
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
  });
}
