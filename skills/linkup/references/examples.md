# Linkup Examples and Edge Cases

Use this file when query shaping is unclear, results are weak, or task requires multi-step retrieval.

## Example queries

### Known URL, extract full content

Use `linkup_web_fetch`.

```ts
linkup_web_fetch("https://example.com/pricing", true)
```

### Quick fact with citation

Use `linkup_web_answer`.

```ts
linkup_web_answer("NVIDIA fiscal year 2025 total revenue")
```

### Discovery then verification

Use `linkup_web_search`, then fetch top sources.

```ts
linkup_web_search("OpenAI product announcements January 2026", "standard")
```

Then fetch strongest URLs from the results.

### Complex/ambiguous research

Escalate to deep.

```ts
linkup_web_search("compare top Rust web frameworks performance benchmarks 2025", "deep")
```

## Edge-case playbook

- `linkup_web_answer` is too shallow:
  - Run `linkup_web_search` with a narrower query.
  - Fetch 1-3 primary sources and synthesize.

- Content missing on fetch:
  - Retry with `renderJs: true`.
  - If still empty, use alternate source and state limitation.

- Conflicting sources:
  - Prefer official/primary source.
  - Report conflict and uncertainty explicitly.

- Vague query returning noisy results:
  - Add timeframe, region, and official domain constraints.
  - Split into 2-4 focused queries.
