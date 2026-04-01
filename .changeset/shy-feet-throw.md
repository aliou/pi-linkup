---
"@aliou/pi-linkup": minor
---

refactor: per-extension entries to fix duplicate command registration

Replace monolithic entry with 4 separate extension entries:

- web-search, web-answer, web-fetch (tools)
- command-balance (shows API credits)

Delete broken singleton pattern from setup.ts that caused
commands to appear 3x in palette (GitHub #24). Pi loads each
extension in separate module context, so module-level guards
failed. Each entry now calls ensureLinkupReady() independently.

Also remove obsolete command-settings (guidance settings no
longer exist; tools declare their own promptGuidelines).
