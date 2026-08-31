---
name: linkup
description: "Web search and content fetching using Linkup extension. Use when needing to search the web, get answers to questions with sources, or fetch content from specific URLs. Provides four tools: linkup_web_search (discovery), linkup_web_answer (direct answers), linkup_web_fetch (URL content extraction), and linkup_research (asynchronous deep research: submits a task and returns immediately; the sourced answer arrives later as a follow-up message). linkup_research is opt-in (off by default; enable via /linkup:settings)."
---

# Linkup Extension

Web search and content fetching tools powered by Linkup API.

## Tools

### linkup_web_search

Search the web and get sources with content snippets.

```
linkup_web_search(query: string, depth?: "fast" | "standard" | "deep", limit?: number)
```

- `query`: Be specific and detailed. Include context like dates, locations, company names.
- `depth`: Search depth mode. Default: "standard".
  - `fast`: Sub-second latency, uses pre-indexed "atoms of information". Best for quick facts and simple lookups.
  - `standard`: Single iteration retrieval. Balanced speed and depth for most queries.
  - `deep`: Up to 10 iterations with chain-of-thought reasoning. Best for complex multi-step research (slower).
- `limit`: Maximum number of results. Default: 10.

Search result content is truncated per result. If a result is truncated, the tool output includes a temp file path with the full result content.

**Use when:** Discovering information across multiple sources, researching topics, comparing perspectives.

### linkup_web_answer

Get a synthesized answer with source citations.

```
linkup_web_answer(query: string, depth?: "fast" | "standard" | "deep")
```

- `query`: Be specific and detailed.
- `depth`: Same depth modes as `linkup_web_search`. Default: "standard".

The answer and source snippets are truncated independently. If any block is truncated, the tool output includes a temp file path with the full block content.

**Use when:** Need a direct answer to a specific question, quick facts with citations.

### linkup_web_fetch

Fetch content from a URL as clean markdown.

```
linkup_web_fetch(url: string, renderJs?: boolean)
```

- `url`: The URL to fetch.
- `renderJs`: Set false for static pages (faster). Default: true.

Fetched markdown is truncated when large. If it is truncated, the tool output includes a temp file path with the full markdown content.

**Use when:** Reading documentation, following up on search results, extracting content from known URLs.

### linkup_research

Submit an autonomous deep research task. **Asynchronous**: the tool returns immediately (~1s) with a task id, and the completed, sourced answer is delivered later as a follow-up `linkup-research-result` message (2-20 minutes depending on depth).

> **Opt-in**: this tool is expensive ($0.25-$2.50 per call) and ships **inactive by default**. Enable it with `/linkup:settings` (research.enabled on) or by setting `research.enabled: true` in `~/.pi/agent/extensions/pi-linkup.json`. If the tool is not available, tell the user to enable it via `/linkup:settings`.

```
linkup_research(query: string, mode?: "answer" | "investigate" | "research", reasoningDepth?: "S" | "M" | "L" | "XL", includeDomains?: string[], excludeDomains?: string[], fromDate?: string, toDate?: string)
```

- `query`: The research question. Both terse and detailed inputs are accepted; more precise input produces more predictable output. Specify angles to cover, entities to compare, facts to verify, and the expected output structure.
- `mode`: Type of investigation. Setting it explicitly is recommended for predictable latency, cost, and output shape:
  - `answer`: Precise, evidence-backed answers to questions with a definitive solution.
  - `investigate`: Focused report on a single defined subject (deep-dive on one entity).
  - `research`: Structured report covering many topics or entities in parallel.
  - If omitted, the agent classifies the question and picks a mode.
- `reasoningDepth`: Thoroughness, trading latency for cost:
  - `S`: Light coverage, 2-5 min, $0.25 per call.
  - `M`: Balanced routine use, 3-7 min, $0.50 per call.
  - `L`: Thorough investigation (default), 5-10 min, $1.50 per call.
  - `XL`: Exhaustive coverage, 10-20 min, $2.50 per call.
- `includeDomains` / `excludeDomains`: Restrict or exclude domains (up to 100). A few trusted domains improves quality and reduces latency.
- `fromDate` / `toDate`: ISO 8601 dates (YYYY-MM-DD) restricting the time range. Prefer these over embedding dates in the question.

The tool submits the task to Linkup and returns immediately with the task id. A background poller (owned by the extension, tunable via `/linkup:settings`) polls the server and delivers the sourced answer as a follow-up message when the task completes. After submitting, tell the user the research is running and continue with other work - do not wait for, sleep on, or poll the result. Tasks are persistent server-side (ids survive across sessions).

**Use when:** Questions a single search cannot resolve: verified answers to precise high-stakes questions, focused investigations of a defined subject, or broad multi-angle reports. This tool is expensive and slow: always prefer `linkup_web_search` or `linkup_web_answer` first and fall back to `linkup_research` only for multi-source synthesis, comparative analysis, or audit-trail research.

### linkup_research_status

Check or fetch Linkup research tasks on demand.

```
linkup_research_status(taskId?: string)
```

- `taskId`: Fetch one task's current state (works for any task id, including tasks from previous sessions - Linkup tasks are persistent server-side). Without a `taskId`, lists all research tasks known to the current session with status and elapsed time.

**Use when:** The user asks about the progress of a research task, or a follow-up message carried only a task id (ping delivery mode) and you need to fetch the full result. Do not call this in a loop to wait; tasks take minutes and the result is delivered automatically.

## Tool Selection

| Need | Tool |
|------|------|
| Find information across sources | `linkup_web_search` |
| Get a direct answer with sources | `linkup_web_answer` |
| Read content from a known URL | `linkup_web_fetch` |
| Deep multi-source research or investigation | `linkup_research` (async, opt-in) |
| Check research progress / fetch a completed result | `linkup_research_status` |

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

**Fast:** Sub-second responses for quick facts, simple lookups, known facts.

**Standard (default):** Single iteration, balanced speed/depth for most queries.

**Deep:** Complex research, multi-step queries, comprehensive coverage needed.

**Research escalation:** `linkup_research` costs $0.25-$2.50 per call and takes 2-20 minutes. Reserve it for questions where the agent's planning and synthesis across many sources is the value.

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

### Quick facts
1. `linkup_web_answer` for direct answer with citations

### Documentation reading
1. `linkup_web_fetch` on known documentation URL

### Deep research escalation
1. Start with `linkup_web_answer` or `linkup_web_search` for most questions
2. Escalate to `linkup_research` only when the question needs multi-source synthesis, comparisons across entities, or verified high-stakes facts
3. Use `mode` explicitly and keep `reasoningDepth` at the minimum that fits the task
4. After submitting, tell the user the research is running and continue other work; present the answer when the follow-up message arrives (fetch with `linkup_research_status` if the follow-up only carried a task id)

## Commands

- `/linkup:balance` - Check remaining API credits
- `/linkup:settings` - Configure research tool opt-in, result delivery mode, and poller tuning
