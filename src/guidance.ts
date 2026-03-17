/**
 * System prompt guidance for Linkup tools.
 */
import type { LinkupToolKey } from "./linkup-tools";

export function getLinkupGuidance(tools: Set<LinkupToolKey>): string {
  const toolSelection: string[] = [];
  const depthModes: string[] = [];
  const patterns: string[] = [];

  if (tools.has("webSearch")) {
    toolSelection.push(
      "- Find information across sources: `linkup_web_search`",
    );
    depthModes.push(
      "- `fast`: Sub-second, pre-indexed facts. Use for quick lookups.",
    );
    depthModes.push(
      "- `standard` (default): Single iteration, balanced speed/depth.",
    );
    depthModes.push(
      "- `deep`: Multi-iteration with chain-of-thought. Use for complex research.",
    );
    patterns.push("1. Research: `linkup_web_search` to discover sources");
  }

  if (tools.has("webAnswer")) {
    toolSelection.push(
      "- Get a direct answer with sources: `linkup_web_answer`",
    );
    if (!tools.has("webSearch")) {
      depthModes.push(
        "- `fast`: Sub-second, pre-indexed facts. Use for quick lookups.",
      );
      depthModes.push(
        "- `standard` (default): Single iteration, balanced speed/depth.",
      );
      depthModes.push(
        "- `deep`: Multi-iteration with chain-of-thought. Use for complex research.",
      );
    }
    patterns.push(
      "2. Quick facts: `linkup_web_answer` for a direct answer with citations",
    );
  }

  if (tools.has("webFetch")) {
    toolSelection.push("- Read content from a known URL: `linkup_web_fetch`");
    patterns.push(
      tools.has("webSearch")
        ? "3. Follow-up reading: `linkup_web_fetch` on promising URLs"
        : "3. Documentation: `linkup_web_fetch` on known URL (set `renderJs: false` for static pages)",
    );
  }

  if (toolSelection.length === 0) return "";

  const sections = [
    "## Linkup",
    "",
    `Use the available Linkup tools for web search and content fetching. Enabled tools: ${Array.from(
      tools,
    )
      .map((tool) => {
        if (tool === "webSearch") return "linkup_web_search";
        if (tool === "webAnswer") return "linkup_web_answer";
        return "linkup_web_fetch";
      })
      .join(", ")}.`,
    "",
    "**Tool selection:**",
    ...toolSelection,
    "",
  ];

  if (depthModes.length > 0) {
    sections.push("**Search depth modes:**", ...depthModes, "");
  }

  sections.push(
    "**Query tips:**",
    '- Be specific: "Microsoft fiscal year 2024 total revenue" not "Microsoft revenue"',
    "- Add context: dates, version numbers, company names, locations",
    "",
    "**Common patterns:**",
    ...patterns,
  );

  return `${sections.join("\n")}\n`;
}
