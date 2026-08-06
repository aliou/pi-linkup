---
"@aliou/pi-linkup": minor
---

Report per-request Linkup costs from tools

`linkup_web_search`, `linkup_web_answer`, and `linkup_web_fetch` now return a `usage` object with the Linkup cost, so Pi can include it in session cost totals. Pi peer dependencies were bumped to 0.83.0 and `@sinclair/typebox` was replaced with `typebox`.
