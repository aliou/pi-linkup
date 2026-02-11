import { StringEnum } from "@mariozechner/pi-ai";
import packageJson from "../package.json" with { type: "json" };

import type {
  LinkupBalanceResponse,
  LinkupErrorResponse,
  LinkupFetchResponse,
  LinkupSearchResponse,
  LinkupSourcedAnswerResponse,
} from "./types";

const BASE_URL = "https://api.linkup.so/v1";

export const SearchDepth = StringEnum(["fast", "standard", "deep"], {
  description:
    "Search depth: 'fast' for sub-second quick facts, 'standard' (default) for balanced speed/depth, 'deep' for comprehensive multi-step research (slower).",
});

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
    signal?: AbortSignal;
  }): Promise<LinkupSearchResponse | LinkupSourcedAnswerResponse> {
    return this.request(
      "/search",
      {
        method: "POST",
        body: JSON.stringify({
          q: params.query,
          depth: params.depth,
          outputType: params.outputType,
        }),
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

  async getBalance(): Promise<LinkupBalanceResponse> {
    return this.request("/credits/balance", {
      method: "GET",
    });
  }
}

export function getClient(): LinkupClient {
  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) {
    throw new Error("LINKUP_API_KEY environment variable is not set");
  }
  return new LinkupClient(apiKey);
}
