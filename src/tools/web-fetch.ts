import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { getClient } from "../client";

interface WebFetchDetails {
  url?: string;
  markdown?: string;
  error?: string;
  isError?: boolean;
}

export function registerWebFetchTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "linkup_web_fetch",
    label: "Linkup Web Fetch",
    description:
      "Fetch and extract content from a specific URL using Linkup API. Returns clean markdown content. Use for reading documentation, articles, or any specific webpage.",
    parameters: Type.Object({
      url: Type.String({
        description: "The URL to fetch content from.",
      }),
      renderJs: Type.Optional(
        Type.Boolean({
          description:
            "Whether to render JavaScript on the page. Default: true. Set to false for faster fetching of static pages.",
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
              text: `Fetching ${params.url}...`,
            },
          ],
          details: {},
        });

        const response = await client.fetch({
          url: params.url,
          renderJs: params.renderJs,
        });

        return {
          content: [{ type: "text", text: response.markdown }],
          details: { url: params.url, markdown: response.markdown },
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          details: { error: message, url: params.url, isError: true },
        };
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("Linkup: WebFetch "));
      text += theme.fg("accent", args.url);
      if (args.renderJs === false) {
        text += theme.fg("dim", " (no JS)");
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) {
        const text =
          result.content?.[0]?.type === "text"
            ? result.content[0].text
            : "Fetching...";
        return new Text(theme.fg("dim", text), 0, 0);
      }

      const details = result.details as WebFetchDetails;

      if (details?.isError) {
        const errorMsg =
          result.content?.[0]?.type === "text"
            ? result.content[0].text
            : "Error occurred";
        return new Text(theme.fg("error", errorMsg), 0, 0);
      }

      const markdown = details?.markdown || "";
      const url = details?.url || "";

      let text = theme.fg("success", "✓ Fetched");
      text += ` ${theme.fg("dim", url)}`;

      if (!expanded) {
        const preview = markdown.slice(0, 100).replace(/\n/g, " ");
        text += `\n  ${theme.fg("muted", preview)}`;
        if (markdown.length > 100) {
          text += theme.fg("dim", "...");
        }
        text += theme.fg("muted", ` [Ctrl+O to expand]`);
      }

      if (expanded) {
        const lines = markdown.split("\n");
        const previewLines = lines.slice(0, 50);
        text += `\n\n${previewLines.join("\n")}`;
        if (lines.length > 50) {
          text += `\n${theme.fg("dim", `\n[${lines.length - 50} more lines...]`)}`;
        }
      }

      return new Text(text, 0, 0);
    },
  });
}
