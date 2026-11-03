import { type Static, type TSchema, Type } from "typebox";
import { Value } from "typebox/value";
import packageJson from "../package.json" with { type: "json" };

import {
  type LinkupBalanceResponse,
  type LinkupFetchResponse,
  type LinkupSearchResponse,
  type LinkupSourcedAnswerResponse,
  type LinkupStructuredSearchResponse,
  linkupAnswerResponseSchema,
  linkupBalanceResponseSchema,
  linkupErrorResponseSchema,
  linkupFetchResponseSchema,
  linkupSearchResponseSchema,
  linkupStructuredSearchResponseSchema,
} from "./types";

const BASE_URL = "https://api.linkup.so/v1";

export const SearchDepth = Type.Union(
  [
    Type.Literal("flash"),
    Type.Literal("fast"),
    Type.Literal("standard"),
    Type.Literal("deep"),
  ],
  {
    description:
      "Search depth: 'flash' for lowest-latency indexed snippets (alpha), 'fast' for one-shot indexed retrieval, 'standard' (default) for single-pass agentic search, 'deep' for multi-step research. flash and fast do not interpret retrieval instructions.",
  },
);

export type SearchDepthType = Static<typeof SearchDepth>;

export const searchFilters = Type.Object({
  includeDomains: Type.Optional(
    Type.Array(Type.String(), {
      maxItems: 100,
      description: "Restrict search to these domains (up to 100).",
    }),
  ),
  excludeDomains: Type.Optional(
    Type.Array(Type.String(), {
      maxItems: 100,
      description: "Exclude these domains from search (up to 100).",
    }),
  ),
  fromDate: Type.Optional(
    Type.String({
      format: "date",
      description:
        "Earliest result date, YYYY-MM-DD; after 1970-01-01 and before toDate.",
    }),
  ),
  toDate: Type.Optional(
    Type.String({
      format: "date",
      description:
        "Latest result date, YYYY-MM-DD; after fromDate or 1970-01-01.",
    }),
  ),
});

type SearchParams = Static<typeof searchFilters> & {
  query: string;
  depth: SearchDepthType;
  maxResults?: number;
  includeImages?: boolean;
  signal?: AbortSignal;
} & (
    | { outputType: "searchResults" }
    | { outputType: "sourcedAnswer"; includeInlineCitations?: boolean }
    | {
        outputType: "structured";
        structuredOutputSchema: Record<string, unknown>;
      }
  );

export class LinkupClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T extends TSchema>(
    endpoint: string,
    schema: T,
    options: RequestInit = {},
    signal?: AbortSignal,
  ): Promise<Static<T>> {
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
      const error: unknown = await response.json().catch(() => undefined);
      throw new Error(
        Value.Check(linkupErrorResponseSchema, error)
          ? error.error.message
          : `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return Value.Parse(schema, await response.json());
  }

  async search(
    params: SearchParams & { outputType: "searchResults" },
  ): Promise<LinkupSearchResponse>;
  async search(
    params: SearchParams & { outputType: "sourcedAnswer" },
  ): Promise<LinkupSourcedAnswerResponse>;
  async search(
    params: SearchParams & { outputType: "structured" },
  ): Promise<LinkupStructuredSearchResponse>;
  async search(
    params: SearchParams,
  ): Promise<
    | LinkupSearchResponse
    | LinkupSourcedAnswerResponse
    | LinkupStructuredSearchResponse
  >;
  async search(
    params: SearchParams,
  ): Promise<
    | LinkupSearchResponse
    | LinkupSourcedAnswerResponse
    | LinkupStructuredSearchResponse
  > {
    if (
      (params.fromDate !== undefined && params.fromDate <= "1970-01-01") ||
      (params.toDate !== undefined && params.toDate <= "1970-01-01")
    ) {
      throw new Error("Search dates must be after 1970-01-01.");
    }
    if (
      params.fromDate !== undefined &&
      params.toDate !== undefined &&
      params.fromDate >= params.toDate
    ) {
      throw new Error("fromDate must be before toDate.");
    }
    const { query, signal, ...options } = params;
    if (params.outputType === "structured") {
      if (params.structuredOutputSchema.type !== "object") {
        throw new Error(
          "The structured search schema must have type 'object'.",
        );
      }
      return this.request(
        "/search",
        linkupStructuredSearchResponseSchema,
        {
          method: "POST",
          body: JSON.stringify({
            q: query,
            ...options,
            structuredOutputSchema: JSON.stringify(
              params.structuredOutputSchema,
            ),
            includeSources: true,
          }),
        },
        signal,
      );
    }
    const body = { q: query, ...options };
    return this.request(
      "/search",
      params.outputType === "searchResults"
        ? linkupSearchResponseSchema
        : linkupAnswerResponseSchema,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      signal,
    );
  }

  async fetch(params: {
    url: string;
    renderJs?: boolean;
    mode?: "standard" | "pro";
    includeRawContent?: boolean;
    extractImages?: boolean;
    schema?: Record<string, unknown>;
    instructions?: string;
    signal?: AbortSignal;
  }): Promise<LinkupFetchResponse> {
    if (params.instructions !== undefined && params.schema === undefined) {
      throw new Error(
        "The 'instructions' parameter requires 'schema' to be set.",
      );
    }

    if (
      params.instructions !== undefined &&
      params.instructions.length > 4000
    ) {
      throw new Error(
        "The 'instructions' parameter must be at most 4000 characters.",
      );
    }
    if (params.schema !== undefined && params.schema.type !== "object") {
      throw new Error("The 'schema' parameter must have type 'object'.");
    }

    const body: Record<string, unknown> = {
      url: params.url,
      renderJs: params.renderJs ?? true,
    };
    if (params.mode !== undefined) body.mode = params.mode;
    if (params.includeRawContent !== undefined)
      body.includeRawContent = params.includeRawContent;
    if (params.extractImages !== undefined)
      body.extractImages = params.extractImages;
    if (params.schema !== undefined) body.schema = params.schema;
    if (params.instructions !== undefined)
      body.instructions = params.instructions;

    return this.request(
      "/fetch",
      linkupFetchResponseSchema,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      params.signal,
    );
  }

  async getBalance(): Promise<LinkupBalanceResponse> {
    return this.request("/credits/balance", linkupBalanceResponseSchema, {
      method: "GET",
    });
  }
}

import { getLinkupApiKey } from "./lib/env";

export function getClient(): LinkupClient {
  return new LinkupClient(getLinkupApiKey());
}
