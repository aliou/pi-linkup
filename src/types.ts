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

export interface LinkupResearchInput {
  q: string;
  outputType?: "sourcedAnswer" | "structured";
  structuredOutputSchema?: string;
  mode?: ResearchMode;
  reasoningDepth?: ResearchReasoningDepth;
  includeDomains?: string[];
  excludeDomains?: string[];
  fromDate?: string;
  toDate?: string;
}

export type ResearchMode = "answer" | "investigate" | "research";

export type ResearchReasoningDepth = "S" | "M" | "L" | "XL";

export interface LinkupResearchSourcedAnswer {
  answer: string;
  sources: LinkupSource[];
}

export type LinkupResearchStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface LinkupResearchTask {
  id: string;
  type: "research";
  status: LinkupResearchStatus;
  createdAt: string;
  updatedAt: string;
  error?: string | null;
  input: LinkupResearchInput;
  output?: LinkupResearchSourcedAnswer | Record<string, unknown> | null;
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
  researchDepthS: 0.25,
  researchDepthM: 0.5,
  researchDepthL: 1.5,
  researchDepthXL: 2.5,
} as const;
