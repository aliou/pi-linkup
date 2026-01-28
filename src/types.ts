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
