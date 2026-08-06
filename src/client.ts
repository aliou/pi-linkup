import { Type } from "typebox";
import packageJson from "../package.json" with { type: "json" };

import type {
  LinkupBalanceResponse,
  LinkupErrorResponse,
  LinkupFetchResponse,
  LinkupSearchResponse,
  LinkupSourcedAnswerResponse,
} from "./types";
import { LINKUP_PRICING } from "./types";

const BASE_URL = "https://api.linkup.so/v1";

export const SearchDepth = Type.Union(
  [Type.Literal("fast"), Type.Literal("standard"), Type.Literal("deep")],
  {
    description:
      "Search depth: 'fast' for sub-second quick facts, 'standard' (default) for balanced speed/depth, 'deep' for comprehensive multi-step research (slower).",
  },
);

export type SearchDepthType = "fast" | "standard" | "deep";

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
  }): Promise<{
    data: LinkupSearchResponse | LinkupSourcedAnswerResponse;
    cost: number;
  }> {
    const body: Record<string, unknown> = {
      q: params.query,
      depth: params.depth,
      outputType: params.outputType,
    };
    if (params.maxResults !== undefined) {
      body.maxResults = params.maxResults;
    }
    const data = (await this.request(
      "/search",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      params.signal,
    )) as LinkupSearchResponse | LinkupSourcedAnswerResponse;

    const cost =
      params.depth === "deep"
        ? LINKUP_PRICING.deepSearch
        : LINKUP_PRICING.standardSearch;

    return { data, cost };
  }

  async fetch(params: {
    url: string;
    renderJs?: boolean;
    signal?: AbortSignal;
  }): Promise<{ data: LinkupFetchResponse; cost: number }> {
    const data = (await this.request(
      "/fetch",
      {
        method: "POST",
        body: JSON.stringify({
          url: params.url,
          renderJs: params.renderJs ?? true,
        }),
      },
      params.signal,
    )) as LinkupFetchResponse;

    const cost =
      (params.renderJs ?? true)
        ? LINKUP_PRICING.fetchWithJs
        : LINKUP_PRICING.fetchNoJs;

    return { data, cost };
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
