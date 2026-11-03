---
name: linkup
description: "Web search and content fetching using Linkup extension. Use when needing to search the web, get answers to questions with sources, or fetch content from specific URLs. Provides three tools: linkup_web_search (discovery), linkup_web_answer (direct answers), linkup_web_fetch (URL content extraction)."
---

# Linkup Extension

Web search and content fetching tools powered by Linkup API.

## Tools

### linkup_web_search

Search the web and get sources with content snippets.

```
linkup_web_search(query: string, depth?: "flash" | "fast" | "standard" | "deep", limit?: number, schema?: object, includeImages?: boolean, includeDomains?: string[], excludeDomains?: string[], fromDate?: string, toDate?: string)
```

- `query`: Be specific and detailed. Include context like dates, locations, company names.
- `depth`: Search depth mode. Default: "standard".
  - `flash`: Lowest-latency indexed snippets (alpha, typically under 200 ms).
  - `fast`: One-shot indexed retrieval (typically around 1 second). Neither flash nor fast interprets retrieval instructions or scrapes pages.
  - `standard`: Single iteration retrieval. Balanced speed and depth for most queries.
  - `deep`: Up to 10 iterations with chain-of-thought reasoning. Best for complex multi-step research (slower).
- `limit`: Positive integer maximum number of results. Default: 10.
- `schema`: JSON Schema with root type `object` for typed web search. Returns a `data` object plus source `results`; uses the same composition rate as answers.
- `includeImages`: Include image results alongside text results. Default: false.
- `includeDomains` / `excludeDomains`: Restrict or exclude domains, up to 100 each.
- `fromDate` / `toDate`: ISO calendar dates (`YYYY-MM-DD`) after 1970-01-01. When both are set, `fromDate` must precede `toDate`. These filters also work on `linkup_web_answer`.

Search result content is truncated per result. If a result is truncated, the tool output includes a temp file path with the full result content.

**Use when:** Discovering information across multiple sources, researching topics, comparing perspectives.

### linkup_web_answer

Get a synthesized answer with source citations.

```
linkup_web_answer(query: string, depth?: "flash" | "fast" | "standard" | "deep", includeDomains?: string[], excludeDomains?: string[], fromDate?: string, toDate?: string, includeInlineCitations?: boolean)
```

- `query`: Be specific and detailed.
- `depth`: Same depth modes as `linkup_web_search`. Default: "standard".
- `includeInlineCitations`: Include inline citations in the answer. Default: false.

The answer and source snippets are truncated independently. If any block is truncated, the tool output includes a temp file path with the full block content.

**Use when:** Need a direct answer to a specific question, quick facts with citations.

### linkup_web_fetch

Fetch content from a URL (HTML page or PDF, PDFs up to 100 MB) as clean markdown, optionally with typed JSON extraction.

```
linkup_web_fetch(url: string, renderJs?: boolean, mode?: "standard" | "pro", schema?: object, instructions?: string, includeRawContent?: boolean, extractImages?: boolean)
```

- `url`: The URL to fetch.
- `includeRawContent`: Include raw page content and its content type. Default: false.
- `extractImages`: Include image URLs and alt text. Default: false.
- `renderJs`: Set false for static pages (faster, cheaper). Default: true.
- `mode`: "standard" (default) for regular pages; "pro" for hard-to-retrieve pages.
- `schema`: JSON Schema of type object. Turns structured extraction on; the result gains a `data` object alongside the markdown.
- `instructions`: Extraction rules the schema cannot express (currency, which prices to keep, how to split rows). Requires `schema`, max 4000 characters.

Fetched content is truncated when large. If it is truncated, the tool output includes a temp file path with the full content.

**Structured extraction notes:**
- Keep the schema shallow: primitive fields and one level of arrays are more reliable than deep nesting.
- Field `description`s tell the model what to look for — they do the extraction work.
- Fields without a grounded value on the page are omitted from `data`, even when marked `required`; values are never invented.
- The call is slower and costs an extra $0.001 when a schema is set. If extraction fails after a successful scrape, the call errors and is not billed.

```
linkup_web_fetch(url: "https://example.com/pricing", schema: {"type": "object", "properties": {"plans": {"type": "array", "items": {"type": "object", "properties": {"name": {"type": "string", "description": "Plan name"}, "priceUsd": {"type": "number", "description": "Public list price in USD"}}}}}}, instructions: "Use public list prices only and express monetary values in USD.")
```

**Use when:** Reading documentation, following up on search results, extracting markdown or typed JSON (with `schema`) from known URLs, reading PDFs.

## Programmatic results

All three tools declare output schemas. Codemode calls receive complete API data separately from the model-facing preview: search returns `query` and `results` (including full `content`), plus `data` when a schema is supplied, answer returns `query`, `answer`, and `sources`, and fetch returns `url`, `markdown`, optional extracted `data`, and requested raw content/images.

Check `truncated` before accessing the data. Results up to 1 MiB return `truncated: false`. Larger results return only `truncated: true` and `fullOutputPath`, a private JSON file containing the complete result. Read that file to recover the data. Model-facing previews remain capped at 2000 lines / 50 KB per call, and their private temp files are independent of this structured-result limit.

## Tool Selection

| Need | Tool |
|------|------|
| Find information across sources | `linkup_web_search` |
| Get a direct answer with sources | `linkup_web_answer` |
| Read content from a known URL | `linkup_web_fetch` |

## Query Formulation

**Good queries are specific:**

| Bad | Good |
|-----|------|
| "Microsoft revenue" | "Microsoft fiscal year 2024 total revenue" |
| "React hooks" | "React useEffect cleanup function best practices" |
| "AI news" | "OpenAI announcements January 2026" |

**Add context:**
- Time: "2025", "last quarter", "since version 5.0"
- Location: "French company Total", "US market"
- Specifics: company names, version numbers, exact terms

## Depth Mode Selection

**Flash:** Lowest-latency indexed snippets. Alpha; use for latency-sensitive lookups.

**Fast:** One-shot indexed retrieval for quick facts and simple lookups. Write search keywords rather than multi-step instructions.

**Standard (default):** Single iteration, balanced speed/depth for most queries.

**Deep:** Complex research, multi-step queries, comprehensive coverage needed.

```
// Fast - instant facts, sub-second
linkup_web_search("Node.js 22 release date", depth: "fast")

// Standard - balanced, one search iteration
linkup_web_search("React useEffect cleanup best practices")

// Deep - complex research, multiple iterations
linkup_web_search("comparison of Rust web frameworks performance benchmarks 2025", depth: "deep")
```

## Common Patterns

### Research workflow
1. `linkup_web_search` to discover sources
2. `linkup_web_fetch` on promising URLs for full content
3. Pass `schema` (and `instructions`) to `linkup_web_fetch` when you need typed fields from a page instead of parsing markdown
4. Retry with `mode: "pro"` when a fetch fails or returns suspiciously little content on a hard-to-retrieve page

### Quick facts
1. `linkup_web_answer` for direct answer with citations

### Documentation reading
1. `linkup_web_fetch` on known documentation URL

## Costs

Successful tool calls report estimated USD costs to Pi session totals. Failed calls do not report usage. These are published rate estimates, not provider-reported billing.

| Operation | Cost per call |
|-----------|---------------|
| Search, flash / fast / standard | $0.005 |
| Search, deep | $0.05 |
| Answer or schema-shaped search, flash / fast / standard | $0.006 |
| Answer or schema-shaped search, deep | $0.055 |
| Fetch, standard, no JS / JS | $0.001 / $0.005 |
| Fetch, pro, no JS / JS | $0.005 / $0.01 |
| Fetch structured extraction | Add $0.001 |

## Commands

- `/linkup:balance` - Check remaining API credits
