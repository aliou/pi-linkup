# @aliou/pi-linkup

## 0.13.0

### Minor Changes

- 72e4e83: Support schema-shaped web search with sources through the optional search schema parameter, plus image search and fetch raw content/image extraction. Preserve existing defaults and result fields, validate responses, retain full structured payloads independently of bounded previews, and account for structured-search composition pricing.
- f9fb9a3: Support Pi 1.5 with host-provided SDK and TypeBox peers, typed tool definitions, and keybinding hints from the render context. Update the shared UI dependency to support Pi 1.x.
- 080662c: Add a global proxyUrl setting in /linkup:settings to route all Linkup API calls through a compatible HTTP(S) API base URL. Proxy requests omit the Linkup API key and can use keyless authenticated gateways; direct access still requires LINKUP_API_KEY. Preserve direct routing by default and validate proxy URLs before use. Check changed proxy endpoints with a non-billed credits/balance request before saving; failed checks leave the previous configuration intact.
- a094fd8: Expose flash search, domain and date filters on search and answer tools, and optional inline citations on answers. Preserve result type and favicon metadata in structured output, and document the retrieval modes without changing the standard-depth default.
- 381f34c: Add /linkup:settings with independent, global tool exposure settings for search, answer, and fetch. Defaults remain direct; model-only, codemode, deferred, and hidden are available on hosts that support tool exposure. Saved changes apply after /reload or restarting Pi.
- 49915d2: Return complete structured results to codemode callers, with private JSON spill files for results over 1 MiB. Cap model-facing output per call, protect temp files, validate API responses and fetch extraction inputs, and declare read-only/open-world tool annotations.
- e69cafe: Include estimated Linkup request costs in Pi session totals, distinguishing search from sourced answers and accounting for Pro fetch, JavaScript rendering, and structured extraction. Show answer rates and the extraction surcharge in the balance command.

### Patch Changes

- 449c644: Ship `CHANGELOG.md` in the npm tarball so pi can show the changelog when the extension updates.
- af8ee1c: Keep onboarding and tool-exposure guidance in the README, focus the bundled skill on agent workflows, and trim contributor instructions to repository-specific invariants.
- d0bd54d: Include the changelog in npm packages so Pi can display extension update notices. Align package documentation with the tool parameters, result limits, pricing, and manifest-based local loading, and verify published resources in CI.

## 0.12.0

### Minor Changes

- 65e8787: Add Fetch Pro mode and structured extraction to `linkup_web_fetch`. The tool gains `mode` (`"standard"`/`"pro"`) and `schema`/`instructions` (typed JSON returned in `data` alongside the markdown) parameters, and documents PDF support up to 100 MB. Updates the balance command with Pro fetch rates and the bundled skill docs.

## 0.11.0

### Minor Changes

- a9ca926: Migrate Pi core package dependencies from `@mariozechner/*` to `@earendil-works/*` namespace.

  - `@mariozechner/pi-coding-agent` → `@earendil-works/pi-coding-agent` 0.74.0
  - `@mariozechner/pi-ai` → `@earendil-works/pi-ai` 0.74.0
  - `@mariozechner/pi-tui` → `@earendil-works/pi-tui` 0.74.0

### Patch Changes

- cbec48a: Truncate Linkup search, answer, and fetch result blocks, with full content saved to temp files when truncated.

## 0.10.3

### Patch Changes

- 5147d4b: Name tools explicitly in promptGuidelines so they make sense in the global system prompt Guidelines section

## 0.10.2

### Patch Changes

- 7216696: Remove prepare script to avoid dev deps being installed on git installs

  The prepare script caused npm to install devDependencies when installing
  from git, resulting in 350MB+ of unnecessary dependencies. Moved husky
  setup to manual step in README development setup instructions.

## 0.10.1

### Patch Changes

- 51e6548: Include skills directory in npm package

## 0.10.0

### Minor Changes

- 42481a6: refactor: per-extension entries to fix duplicate command registration

  Replace monolithic entry with 4 separate extension entries:

  - web-search, web-answer, web-fetch (tools)
  - command-balance (shows API credits)

  Delete broken singleton pattern from setup.ts that caused
  commands to appear 3x in palette (GitHub #24). Pi loads each
  extension in separate module context, so module-level guards
  failed. Each entry now calls ensureLinkupReady() independently.

  Also remove obsolete command-settings (guidance settings no
  longer exist; tools declare their own promptGuidelines).

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
