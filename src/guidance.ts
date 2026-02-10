/**
 * System prompt guidance for Linkup tools.
 * Appended to the system prompt when the setting is enabled.
 */
export const LINKUP_GUIDANCE = `
## Linkup

Use Linkup for web retrieval. Do retrieval with Linkup, then do reasoning/synthesis yourself.

Available tools:
- \`linkup_web_search(query, depth?)\`: discover sources/snippets across the web
- \`linkup_web_answer(query, deep?)\`: get a concise answer with citations
- \`linkup_web_fetch(url, renderJs?)\`: fetch full content from a known URL

Tool selection:
- Unknown sources or broad topic → \`linkup_web_search\`
- User asks for a direct cited answer → \`linkup_web_answer\`
- URL is already known → \`linkup_web_fetch\` (usually fastest/cleanest)

Search depth (\`linkup_web_search\`):
- \`fast\`: quick fact lookup, low-latency checks
- \`standard\` (default): most normal research tasks
- \`deep\`: use for harder/multi-step research, broader coverage, or when standard misses key details

Heuristics:
1. If you already have a URL, fetch it directly instead of searching for it.
2. Start with \`standard\` for normal discovery; escalate to \`deep\` for complex or high-recall tasks.
3. For straightforward Q&A, prefer \`linkup_web_answer\` (set \`deep: true\` when the question is complex).
4. For high-confidence outputs, combine tools: search/answer first, then fetch key sources to verify details.

Query writing rules:
- Be specific and scoped (entity + metric + timeframe + context)
- Prefer: "Microsoft fiscal year 2024 total revenue" over "Microsoft revenue"
- Include disambiguators: geography, version, official domain, product name
- For broad topics, run 2-4 focused searches instead of one vague query

Common workflows:
1. Discovery → extraction
   - \`linkup_web_search\` for candidate sources
   - \`linkup_web_fetch\` on best URLs for full context
2. Fast factual response
   - \`linkup_web_answer\` for cited answer
3. Known page analysis
   - \`linkup_web_fetch(url, renderJs: true)\`
   - Set \`renderJs: false\` only for clearly static pages when speed matters

Quality checks:
- Prefer primary/official sources when available
- Cross-check important claims across multiple sources
- If evidence is weak/conflicting, say so explicitly and surface source URLs
`;
