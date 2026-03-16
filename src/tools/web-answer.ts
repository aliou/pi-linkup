import { ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme, keyHint } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import { getClient, SearchDepth, type SearchDepthType } from "../client";
import type { LinkupSource, LinkupSourcedAnswerResponse } from "../types";

interface WebAnswerDetails {
  answer?: string;
  sources?: LinkupSource[];
  query?: string;
}

const parameters = Type.Object({
  query: Type.String({
    description:
      "The question to answer. Be specific and detailed for best results.",
  }),
  depth: Type.Optional(SearchDepth),
});

type WebAnswerParams = Static<typeof parameters>;

export const webAnswerTool = {
  name: "linkup_web_answer",
  label: "Linkup Web Answer",
  description:
    "Get a synthesized answer to a question using Linkup API. Returns a direct answer with sources. Use when you need a concise answer to a specific question.",
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

    let content = `${response.answer}\n\n`;
    content += "Sources:\n";
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
      text += theme.fg("muted", ` ${keyHint("expandTools", "to expand")}`);
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

export function registerWebAnswerTool(pi: ExtensionAPI) {
  pi.registerTool(webAnswerTool);
}
