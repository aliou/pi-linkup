import type { Usage } from "@earendil-works/pi-ai";

export interface LinkupSearchResult {
  name: string;
  url: string;
  content?: string;
}

export interface LinkupSearchResponse {
  results: LinkupSearchResult[];
}

export interface LinkupSource {
  name: string;
  url: string;
  snippet?: string;
}

export interface LinkupSourcedAnswerResponse {
  answer: string;
  sources: LinkupSource[];
}

export interface LinkupFetchResponse {
  markdown: string;
}

export interface LinkupBalanceResponse {
  balance: number;
}

export interface LinkupErrorResponse {
  error?: {
    message?: string;
  };
}

/**
 * Credit cost per request by operation type.
 * Source: https://docs.linkup.so/pages/documentation/development/pricing
 */
export const LINKUP_PRICING = {
  standardSearch: 0.005,
  deepSearch: 0.05,
  fetchNoJs: 0.001,
  fetchWithJs: 0.005,
} as const;

/**
 * Build a Usage object from a Linkup dollar cost. Linkup charges per request,
 * not per token, so we report the cost as a request cost and zero out the
 * token fields while setting the totals so Pi can include it in session costs.
 */
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
    },
  };
}
