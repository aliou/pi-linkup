---
"@aliou/pi-linkup": minor
---

Add fast mode support to linkup_web_search tool. The depth parameter now accepts "fast", "standard", or "deep" modes:
- fast: Sub-second latency using pre-indexed atoms of information
- standard: Single iteration retrieval, balanced speed/depth (default)
- deep: Up to 10 iterations with chain-of-thought reasoning
