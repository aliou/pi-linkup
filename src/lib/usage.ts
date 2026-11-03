import type { Usage } from "@earendil-works/pi-ai";
import type { SearchDepthType } from "../client";
import { LINKUP_PRICING } from "../types";

export function searchCost(
  depth: SearchDepthType,
  outputType: "searchResults" | "sourcedAnswer" | "structured",
) {
  if (outputType !== "searchResults") {
    return depth === "deep"
      ? LINKUP_PRICING.deepAnswer
      : LINKUP_PRICING.standardAnswer;
  }
  return depth === "deep"
    ? LINKUP_PRICING.deepSearch
    : LINKUP_PRICING.standardSearch;
}

export function fetchCost(
  mode: "standard" | "pro",
  renderJs: boolean,
  structured: boolean,
) {
  let base: number = renderJs
    ? LINKUP_PRICING.fetchWithJs
    : LINKUP_PRICING.fetchNoJs;
  if (mode === "pro") {
    base = renderJs
      ? LINKUP_PRICING.fetchProWithJs
      : LINKUP_PRICING.fetchProNoJs;
  }
  return base + (structured ? LINKUP_PRICING.fetchStructured : 0);
}

export function linkupCostUsage(cost: number): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: cost,
      totalFromProvider: false,
    },
  };
}
