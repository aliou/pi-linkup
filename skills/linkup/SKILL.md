---
name: linkup
description: "Use when tasks require web retrieval: discover sources, answer factual questions with citations, or extract content from known URLs. Covers tool selection, query construction, depth choice, and verification for linkup_web_search, linkup_web_answer, and linkup_web_fetch."
---

# Linkup

Use Linkup for retrieval. Retrieve first, then reason from sources.

## Select the tool

- `linkup_web_search(query: string, depth?: "fast" | "standard" | "deep")`: discover sources when URL is unknown.
- `linkup_web_answer(query: string, deep?: boolean)`: return a direct cited answer.
- `linkup_web_fetch(url: string, renderJs?: boolean)`: fetch full content from a known URL.

Rule: if URL is known, prefer `linkup_web_fetch` over search.

## Choose search depth (`linkup_web_search`)

- `fast`: quick fact checks.
- `standard` (default): most tasks.
- `deep`: complex or ambiguous research, broad recall, or when standard misses details.

## Write effective queries

Use: **entity + metric + timeframe + context**.

- Weak: `Microsoft revenue`
- Better: `Microsoft fiscal year 2024 total revenue`

Add disambiguators when needed: region, product, version, official domain.

## Workflows

1. Discovery + verification
   - `linkup_web_search`
   - `linkup_web_fetch` on top URLs

2. Quick cited answer
   - `linkup_web_answer`
   - Fetch top source only if extra confidence needed

3. Known URL extraction
   - `linkup_web_fetch(url, renderJs: true)`
   - Set `renderJs: false` only for clearly static pages when speed matters

## Quality checks

- Prefer primary/official sources.
- Cross-check high-impact claims across multiple sources.
- If sources conflict or are weak, state uncertainty explicitly.

## More examples

Read `references/examples.md` when query shaping is unclear or when handling weak/conflicting results.

## Command

- `/linkup:balance` to check API credits.
