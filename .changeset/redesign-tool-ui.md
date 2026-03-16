---
"@aliou/pi-linkup": minor
---

Redesign all tool UIs to use structured rendering components

- web-search: ToolCallHeader, Container/Markdown/ToolFooter, collapsed/expanded states with blockquote snippets
- web-answer: ToolCallHeader, answer preview collapsed, full Markdown answer expanded with sources list
- web-fetch: ToolCallHeader, Markdown content preview matching read_url pattern (8 lines collapsed, full expanded)
- All tools: throw errors instead of returning error details, proper error display via content extraction
- All tools: use keyHint for expand hints, ToolFooter for metadata
