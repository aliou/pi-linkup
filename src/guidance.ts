/**
 * System prompt guidance for Linkup tools.
 * Appended to the system prompt when the setting is enabled.
 */
export const LINKUP_GUIDANCE = `
## Linkup

Use the Linkup tools for web search and content fetching. Three tools are available: linkup_web_search (discovery), linkup_web_answer (direct answers), linkup_web_fetch (URL content extraction).

**Tool selection:**
- Find information across sources: \`linkup_web_search\`
- Get a direct answer with sources: \`linkup_web_answer\`
- Read content from a known URL: \`linkup_web_fetch\`

**Search depth modes (linkup_web_search):**
- \`fast\`: Sub-second, pre-indexed facts. Use for quick lookups.
- \`standard\` (default): Single iteration, balanced speed/depth.
- \`deep\`: Multi-iteration with chain-of-thought. Use for complex research.

**Query tips:**
- Be specific: "Microsoft fiscal year 2024 total revenue" not "Microsoft revenue"
- Add context: dates, version numbers, company names, locations

**Common patterns:**
1. Research: \`linkup_web_search\` to discover, then \`linkup_web_fetch\` on promising URLs
2. Quick facts: \`linkup_web_answer\` for direct answer with citations
3. Documentation: \`linkup_web_fetch\` on known URL (set \`renderJs: false\` for static pages)
`;
