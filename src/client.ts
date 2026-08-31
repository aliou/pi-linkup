import { Type } from "@sinclair/typebox";
import packageJson from "../package.json" with { type: "json" };

import type {
  LinkupBalanceResponse,
  LinkupErrorResponse,
  LinkupFetchResponse,
  LinkupResearchTask,
  LinkupSearchResponse,
  LinkupSourcedAnswerResponse,
} from "./types";

const BASE_URL = "https://api.linkup.so/v1";

export const SearchDepth = Type.Union(
  [Type.Literal("fast"), Type.Literal("standard"), Type.Literal("deep")],
  {
    description:
      "Search depth: 'fast' for sub-second quick facts, 'standard' (default) for balanced speed/depth, 'deep' for comprehensive multi-step research (slower).",
  },
);

export type SearchDepthType = "fast" | "standard" | "deep";

export const ResearchMode = Type.Union(
  [
    Type.Literal("answer"),
    Type.Literal("investigate"),
    Type.Literal("research"),
  ],
  {
    description:
      "Research mode: 'answer' for precise, evidence-backed answers to questions with a definitive solution, 'investigate' for a focused report on a single defined subject, 'research' for a structured report covering many topics or entities in parallel. Omit to let the agent classify the question.",
  },
);

export type ResearchModeType = "answer" | "investigate" | "research";

export const ResearchReasoningDepth = Type.Union(
  [Type.Literal("S"), Type.Literal("M"), Type.Literal("L"), Type.Literal("XL")],
  {
    description:
      "Reasoning depth: 'S' light coverage (2-5 min), 'M' balanced routine use (3-7 min), 'L' thorough investigation (5-10 min, default), 'XL' exhaustive coverage (10-20 min). Higher depths cost more ($0.25 to $2.50 per call).",
  },
);

export type ResearchReasoningDepthType = "S" | "M" | "L" | "XL";

export class LinkupClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      signal,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `pi-linkup/${packageJson.version} (+https://github.com/aliou/pi-linkup)`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as LinkupErrorResponse;
      throw new Error(
        error.error?.message ||
          `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json();
  }

  async search(params: {
    query: string;
    depth: SearchDepthType;
    outputType: "searchResults" | "sourcedAnswer";
    maxResults?: number;
    signal?: AbortSignal;
  }): Promise<LinkupSearchResponse | LinkupSourcedAnswerResponse> {
    const body: Record<string, unknown> = {
      q: params.query,
      depth: params.depth,
      outputType: params.outputType,
    };
    if (params.maxResults !== undefined) {
      body.maxResults = params.maxResults;
    }
    return this.request(
      "/search",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      params.signal,
    );
  }

  async fetch(params: {
    url: string;
    renderJs?: boolean;
    signal?: AbortSignal;
  }): Promise<LinkupFetchResponse> {
    return this.request(
      "/fetch",
      {
        method: "POST",
        body: JSON.stringify({
          url: params.url,
          renderJs: params.renderJs ?? true,
        }),
      },
      params.signal,
    );
  }

  async createResearch(params: {
    query: string;
    mode?: ResearchModeType;
    reasoningDepth?: ResearchReasoningDepthType;
    outputType?: "sourcedAnswer" | "structured";
    structuredOutputSchema?: string;
    includeDomains?: string[];
    excludeDomains?: string[];
    fromDate?: string;
    toDate?: string;
    signal?: AbortSignal;
  }): Promise<LinkupResearchTask> {
    const body: Record<string, unknown> = {
      q: params.query,
      outputType: params.outputType ?? "sourcedAnswer",
    };
    if (params.mode !== undefined) {
      body.mode = params.mode;
    }
    if (params.reasoningDepth !== undefined) {
      body.reasoningDepth = params.reasoningDepth;
    }
    if (params.structuredOutputSchema !== undefined) {
      body.structuredOutputSchema = params.structuredOutputSchema;
    }
    if (params.includeDomains !== undefined) {
      body.includeDomains = params.includeDomains;
    }
    if (params.excludeDomains !== undefined) {
      body.excludeDomains = params.excludeDomains;
    }
    if (params.fromDate !== undefined) {
      body.fromDate = params.fromDate;
    }
    if (params.toDate !== undefined) {
      body.toDate = params.toDate;
    }
    return this.request(
      "/research",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      params.signal,
    );
  }

  async getResearch(
    id: string,
    signal?: AbortSignal,
  ): Promise<LinkupResearchTask> {
    return this.request(`/research/${id}`, { method: "GET" }, signal);
  }

  async getBalance(): Promise<LinkupBalanceResponse> {
    return this.request("/credits/balance", {
      method: "GET",
    });
  }
}

import { getLinkupApiKey } from "./lib/env";

export function getClient(): LinkupClient {
  return new LinkupClient(getLinkupApiKey());
}
