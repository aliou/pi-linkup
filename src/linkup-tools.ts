export const LINKUP_TOOL_KEYS = ["webSearch", "webAnswer", "webFetch"] as const;

export type LinkupToolKey = (typeof LINKUP_TOOL_KEYS)[number];

export const LINKUP_TOOL_NAMES: Record<LinkupToolKey, string> = {
  webSearch: "linkup_web_search",
  webAnswer: "linkup_web_answer",
  webFetch: "linkup_web_fetch",
};

export function getLinkupToolKey(toolName: string): LinkupToolKey | null {
  return (
    LINKUP_TOOL_KEYS.find((key) => LINKUP_TOOL_NAMES[key] === toolName) ?? null
  );
}
