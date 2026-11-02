import { type Static, type TSchema, Type } from "typebox";
import { Value } from "typebox/value";
import packageJson from "../package.json" with { type: "json" };

import {
  type LinkupBalanceResponse,
  type LinkupFetchResponse,
  type LinkupSearchResponse,
  type LinkupSourcedAnswerResponse,
  linkupAnswerResponseSchema,
  linkupBalanceResponseSchema,
  linkupErrorResponseSchema,
  linkupFetchResponseSchema,
  linkupSearchResponseSchema,
} from "./types";

const BASE_URL = "https://api.linkup.so/v1";

export const SearchDepth = Type.Union(
  [Type.Literal("fast"), Type.Literal("standard"), Type.Literal("deep")],
  {
    description:
      "Search depth: 'fast' for sub-second quick facts, 'standard' (default) for balanced speed/depth, 'deep' for comprehensive multi-step research (slower).",
  },
);

export type SearchDepthType = Static<typeof SearchDepth>;

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
      params.outputType === "searchResults"
        ? linkupSearchResponseSchema
        : linkupAnswerResponseSchema,
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
    mode?: "standard" | "pro";
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
