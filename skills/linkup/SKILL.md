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
linkup_web_search(query: string, deep?: boolean)
```

- `query`: Be specific and detailed. Include context like dates, locations, company names.
- `deep`: Use for complex research requiring multiple searches. Default: false (faster).

**Use when:** Discovering information across multiple sources, researching topics, comparing perspectives.

### linkup_web_answer

Get a synthesized answer with source citations.

```
linkup_web_answer(query: string, deep?: boolean)
```

**Use when:** Need a direct answer to a specific question, quick facts with citations.

### linkup_web_fetch

Fetch content from a URL as clean markdown.

```
linkup_web_fetch(url: string, renderJs?: boolean)
```

- `url`: The URL to fetch.
- `renderJs`: Set false for static pages (faster). Default: true.

**Use when:** Reading documentation, following up on search results, extracting content from known URLs.

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

## When to Use Deep Mode

**Standard (default):** Simple questions, quick lookups, known topics.

**Deep:** Complex research, multi-step queries, comprehensive coverage needed.

```
// Standard - one search is enough
linkup_web_search("Node.js 22 release date")

// Deep - needs multiple searches
linkup_web_search("comparison of Rust web frameworks performance benchmarks 2025", deep: true)
```

## Common Patterns

### Research workflow
1. `linkup_web_search` to discover sources
2. `linkup_web_fetch` on promising URLs for full content

### Quick facts
1. `linkup_web_answer` for direct answer with citations

### Documentation reading
1. `linkup_web_fetch` on known documentation URL

## Commands

- `/linkup:balance` - Check remaining API credits
