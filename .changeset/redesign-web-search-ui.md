---
"@aliou/pi-linkup": minor
---

Redesign web search tool UI to match pi-synthetic pattern

- Use ToolCallHeader and ToolFooter from @aliou/pi-utils-ui for consistent styling
- Collapsed view shows result count with first result name and expand hint
- Expanded view shows each result with name, URL, and a 5-line blockquote snippet rendered as Markdown
- Error handling uses throw instead of returning error details, matching the pi framework convention
- Errors now display the actual error message instead of misleading "no results"
- Footer shows result count only
- Show search depth as option arg in header when non-standard
