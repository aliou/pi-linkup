---
"@aliou/pi-linkup": minor
---

Add `linkup_research` tool for the Linkup `/research` deep research endpoint. Submits an autonomous research task, polls until completion with backoff (progress shown while running), and returns the sourced answer with citations. Supports `mode` (answer/investigate/research), `reasoningDepth` (S/M/L/XL), domain filters, and date range filters. Costs $0.25-$2.50 per call; the skill and prompt guidance instruct the agent to reserve it for questions simple searches cannot resolve.
