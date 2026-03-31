# @aliou/pi-linkup

## 0.9.0

### Minor Changes

- 92703e6: Truncate large `linkup_web_fetch` outputs in tool results and save the full fetched content to a temp file.
- aac0899: Add a `limit` parameter to `linkup_web_search` so agents can cap returned result count.

## 0.8.2

### Patch Changes

- 3fcbc65: update Pi deps to 0.61.0 and migrate keybinding hints to namespaced ids
- 03cbbb9: Move Linkup tool guidance to prompt metadata and remove the legacy system-prompt guidance setting.

## 0.8.1

### Patch Changes

- c5e5a07: install pi-utils-ui in correct dep group

## 0.8.0

### Minor Changes

- a4905b5: Expose Linkup tools as separate Pi extensions so `pi config` can enable or disable them individually.
- 7334153: Redesign all tool UIs to use structured rendering components

  - web-search: ToolCallHeader, Container/Markdown/ToolFooter, collapsed/expanded states with blockquote snippets
  - web-answer: ToolCallHeader, answer preview collapsed, full Markdown answer expanded with sources list
  - web-fetch: ToolCallHeader, Markdown content preview matching read_url pattern (8 lines collapsed, full expanded)
  - All tools: throw errors instead of returning error details, proper error display via content extraction
  - All tools: use keyHint for expand hints, ToolFooter for metadata

- cb71445: Redesign web search tool UI to match pi-synthetic pattern

  - Use ToolCallHeader and ToolFooter from @aliou/pi-utils-ui for consistent styling
  - Collapsed view shows result count with first result name and expand hint
  - Expanded view shows each result with name, URL, and a 5-line blockquote snippet rendered as Markdown
  - Error handling uses throw instead of returning error details, matching the pi framework convention
  - Errors now display the actual error message instead of misleading "no results"
  - Footer shows result count only
  - Show search depth as option arg in header when non-standard

### Patch Changes

- 290df71: Add a Vitest-based Pi runtime harness to verify per-tool `pi config` loading, shared command registration, and dynamic Linkup system prompt guidance. Closes #17.

## 0.7.4

### Patch Changes

- 856e658: bump @aliou/pi-utils-settings to ^0.10.0 (local scope fix)

## 0.7.3

### Patch Changes

- 9b25dc7: Move `@mariozechner/pi-tui` to peer dependencies to avoid bundling the SDK alongside the extension.
- 34d2538: Remove redundant `console.warn` at extension load time. The `session_start` handler already notifies the user via `ctx.ui.notify` when `LINKUP_API_KEY` is not set.

## 0.7.2

### Patch Changes

- aee0547: mark pi SDK peer deps as optional to prevent koffi OOM in Gondolin VMs

## 0.7.1

### Patch Changes

- 70f79b4: Fix unchecked indexed access in web-search tool renderResult

## 0.7.0

### Minor Changes

- 675ab1d: Export tool definitions as a library via `@aliou/pi-linkup/tools`

## 0.6.2

### Patch Changes

- f591230: fix: forward abort signal to HTTP requests so cancellation propagates

## 0.6.1

### Patch Changes

- d45c015: fix: move @aliou/pi-utils-settings from devDependencies to dependencies

## 0.6.0

### Minor Changes

- e9fdef1: Replace `deep` boolean with `depth` enum on web-answer tool for consistency with web-search

## 0.5.0

### Minor Changes

- 89a92f3: Add configurable system prompt guidance setting via /linkup:settings

## 0.4.0

### Minor Changes

- 052fc2b: Add fast mode support to linkup_web_search tool. The depth parameter now accepts "fast", "standard", or "deep" modes:
  - fast: Sub-second latency using pre-indexed atoms of information
  - standard: Single iteration retrieval, balanced speed/depth (default)
  - deep: Up to 10 iterations with chain-of-thought reasoning

### Patch Changes

- a238ba7: Add User-Agent header to all Linkup API requests for attribution.

## 0.3.1

### Patch Changes

- 1d1dc94: Add demo video URL for the Pi package browser.

## 0.3.0

### Minor Changes

- e57f6fe: Enhanced balance command to show remaining requests per operation type (standard search, deep search, fetch with/without JS) using a themed custom message renderer instead of a transient notification.

## 0.2.0

### Minor Changes

- 2307674: Update pi packages to 0.51.0. Adapt tool execute signatures to new parameter order.
