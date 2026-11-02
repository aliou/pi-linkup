import { type Static, Type } from "typebox";

export const linkupSearchResultSchema = Type.Object({
  name: Type.String(),
  url: Type.String(),
  content: Type.Optional(Type.String()),
});

export const linkupSearchResponseSchema = Type.Object({
  results: Type.Array(linkupSearchResultSchema),
});

export const linkupSourceSchema = Type.Object({
  name: Type.String(),
  url: Type.String(),
  snippet: Type.Optional(Type.String()),
});

export const linkupAnswerResponseSchema = Type.Object({
  answer: Type.String(),
  sources: Type.Array(linkupSourceSchema),
});

export const linkupFetchResponseSchema = Type.Object({
  markdown: Type.String(),
  data: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

export const linkupBalanceResponseSchema = Type.Object({
  balance: Type.Number(),
});

export const linkupErrorResponseSchema = Type.Object({
  error: Type.Object({ message: Type.String() }),
});

export type LinkupSearchResult = Static<typeof linkupSearchResultSchema>;
export type LinkupSearchResponse = Static<typeof linkupSearchResponseSchema>;
export type LinkupSource = Static<typeof linkupSourceSchema>;
export type LinkupSourcedAnswerResponse = Static<
  typeof linkupAnswerResponseSchema
>;
export type LinkupFetchResponse = Static<typeof linkupFetchResponseSchema>;
export type LinkupBalanceResponse = Static<typeof linkupBalanceResponseSchema>;

export const LINKUP_PRICING = {
  standardSearch: 0.005,
  deepSearch: 0.05,
  standardAnswer: 0.006,
  deepAnswer: 0.055,
  fetchNoJs: 0.001,
  fetchWithJs: 0.005,
  fetchProNoJs: 0.005,
  fetchProWithJs: 0.01,
  fetchStructured: 0.001,
} as const;
