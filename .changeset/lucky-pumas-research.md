---
"@aliou/pi-linkup": minor
---

Add async `linkup_research` tool for the Linkup `/research` deep research endpoint, plus `linkup_research_status` and a `/linkup:settings` command. `linkup_research` submits the task and returns immediately with a task id (~1s); an extension-owned background poller (configurable initial/max interval, backoff multiplier, and overall `maxWaitMs` deadline) follows the task on Linkup's servers and delivers the sourced answer as a follow-up message when it completes - the agent's turn is never blocked. Tasks are persistent server-side and re-attached on session resume. `linkup_research_status` lists or fetches tasks on demand (works with ids from previous sessions). Because the tool is expensive ($0.25-$2.50 per call), it is opt-in: it ships registered but inactive, enabled via `/linkup:settings` (`research.enabled`) with runtime toggling (no reload), also configurable in `~/.pi/agent/extensions/pi-linkup.json`.
