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
