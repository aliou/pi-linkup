---
"@aliou/pi-linkup": patch
---

Remove redundant `console.warn` at extension load time. The `session_start` handler already notifies the user via `ctx.ui.notify` when `LINKUP_API_KEY` is not set.
