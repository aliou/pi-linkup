# @aliou/pi-linkup

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
