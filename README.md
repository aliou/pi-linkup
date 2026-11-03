![banner](https://assets.aliou.me/github/aliou/pi-linkup/banner.png)

# pi-linkup

Web search and content fetching for [Pi](https://pi.dev/) using the [Linkup API](https://linkup.so).

## Features

- `linkup_web_search` — Discover sources with content, domain filters, and date controls
- `linkup_web_answer` — Get synthesized answers with sources and optional inline citations
- `linkup_web_fetch` — Extract markdown or typed JSON from HTML and PDF URLs
- `/linkup:balance` — Check credits and approximate remaining calls
- Complete structured results for codemode, bounded display previews, and private spill files
- Estimated Linkup request costs included in Pi session totals

https://github.com/user-attachments/assets/a0f131a4-d57c-4162-aeb5-ffc1a0a8d7ff

## Installation

Get an API key from [app.linkup.so](https://app.linkup.so), then set it in the environment where Pi runs:

```bash
export LINKUP_API_KEY="your-api-key-here"
pi install npm:@aliou/pi-linkup
```

Git installations are also supported:

```bash
pi install git:github.com/aliou/pi-linkup
```

Each tool and the balance command is a separate extension entry, so `pi config` can enable or disable them independently. The bundled skill is available through `/skill:linkup`.

## Tool exposure

Run `/linkup:settings` to choose each tool's exposure independently: `direct` (default), `model-only`, `codemode`, `deferred`, or `hidden`. Save with Ctrl+S, then `/reload` or restart Pi. Exposure requires Pi 0.99.0 or later.

Settings are global, stored in `$PI_CODING_AGENT_DIR/extensions/linkup.json` (normally `~/.pi/agent/extensions/linkup.json`). Deferred tools need `tool_search` or codemode enabled; codemode-only tools need codemode enabled. Hidden tools are unreachable. Tool exposure is not a permission or billing control.

## Search and answer

Use `linkup_web_search` for discovery and `linkup_web_answer` for a direct answer with sources.

| Parameter | Tools | Behavior |
|-----------|-------|----------|
| `query` | Both | Required search query or question |
| `depth` | Both | `"flash"`, `"fast"`, `"standard"` (default), or `"deep"` |
| `includeDomains` / `excludeDomains` | Both | Restrict or exclude up to 100 domains each |
| `fromDate` / `toDate` | Both | ISO calendar dates (`YYYY-MM-DD`) after 1970-01-01; `fromDate` must precede `toDate` |
| `limit` | Search | Positive integer maximum result count; default 10 |
| `schema` | Search | Root-object JSON Schema for typed web data alongside source results |
| `includeImages` | Search | Include relevant images; default false |
| `includeInlineCitations` | Answer | Include inline citations; default false |

### Depth selection

- **Flash:** Alpha, lowest-latency indexed snippets, typically under 200 ms
- **Fast:** One-shot indexed retrieval, typically around one second
- **Standard:** Single-pass agentic search that interprets the query; the extension's default
- **Deep:** Multi-step research for complex or multi-source questions

Flash and fast do not interpret retrieval instructions or scrape pages. Use search keywords for these modes and standard or deep for multi-step instructions.

Example prompts:

```text
Find TypeScript release notes using linkup_web_search, restricted to typescriptlang.org, with limit 3.
```

```text
Use linkup_web_answer with inline citations to summarize the latest stable Node.js release.
```

## Fetch

Use `linkup_web_fetch` when the URL is known, including URLs found by search. It supports HTML and PDF content, including PDFs up to 100 MB.

| Parameter | Behavior |
|-----------|----------|
| `url` | Required URL |
| `renderJs` | Render JavaScript; default true |
| `includeRawContent` | Include raw page content and content type; default false |
| `extractImages` | Include image URLs and alt text; default false |
| `mode` | `"standard"` (default) or `"pro"` for hard-to-retrieve pages |
| `schema` | Optional JSON Schema with root type `"object"`; extracts a `data` object alongside markdown |
| `instructions` | Optional extraction rules, at most 4000 characters; requires `schema` |

Missing extraction fields are omitted from `data`, even when marked required. Keep schemas shallow and use field descriptions to guide extraction. Pro mode and JavaScript rendering are independent; use `renderJs: false` for sites confirmed to render server-side.

```text
Fetch https://example.com/pricing and extract plan names and prices using a JSON Schema.
```

## Results and codemode

Model-facing output is capped at 2000 lines / 50 KB per call, including multi-result search and answer output. Expand a tool result with the configured shortcut (default `Ctrl+O`) to see its previews and sources. Private temp files retain truncated content.

Codemode calls receive complete API data separately from display previews:

- Search: `{ query, results, data?, truncated: false }`, including full result content
- Answer: `{ query, answer, sources, truncated: false }`
- Fetch: `{ url, markdown, data?, favicon?, rawContent?, contentType?, images?, truncated: false }`, with markdown kept separate from extracted data

Results larger than 1 MiB return `{ truncated: true, fullOutputPath }` instead. The path points to a private JSON file containing the complete result. Check `truncated` before accessing inline fields.

```js
const result = await tools.linkup_web_search({
  query: "TypeScript release notes",
  includeDomains: ["typescriptlang.org"],
  limit: 3,
});
if (result.truncated) text({ fullOutputPath: result.fullOutputPath });
else text(result.results.map(({ name, url }) => ({ name, url })));
```

## Costs and balance

Successful calls add estimated USD request costs to Pi session totals. Failed calls do not report usage. These are published-rate estimates, not provider-reported billing.

| Operation | Cost per call |
|-----------|---------------|
| Search, flash / fast / standard | $0.005 |
| Search, deep | $0.05 |
| Answer or schema-shaped search, flash / fast / standard | $0.006 |
| Answer or schema-shaped search, deep | $0.055 |
| Fetch, standard, no JS / JS | $0.001 / $0.005 |
| Fetch, pro, no JS / JS | $0.005 / $0.01 |
| Fetch structured extraction | Add $0.001 |

Run `/linkup:balance` to see remaining credits and approximate remaining search, answer, and fetch calls. See the [Linkup pricing reference](https://docs.linkup.so/pages/documentation/development/pricing) for current rates.

## Development

Uses pnpm 10.26.1, TypeScript, Biome, Vitest, and Changesets.

```bash
git clone https://github.com/aliou/pi-linkup.git
cd pi-linkup
pnpm install
pnpm exec husky
```

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm format
```

Pre-commit hooks run typecheck, lint, and formatting. Add a changeset for user-facing changes:

```bash
pnpm changeset
```

Load the package locally using its manifest, including its skill:

```bash
pi -e .
```

## Compatibility

Developed and tested against Pi 1.5.0, with a runtime smoke check against Pi 0.74.0. Structured results and annotations require the host APIs introduced in Pi 0.99.0; older hosts retain text output. Keybinding hints use the host render context when available and the SDK helper otherwise.

The Pi SDK and TypeBox are optional host-provided peers, not bundled runtime dependencies. Node.js must satisfy the installed Pi release's requirements; Pi 1.5.0 requires Node.js 22.19.0 or later. `LINKUP_API_KEY` is required to register Linkup tools and commands.

## Links

- [Linkup Documentation](https://docs.linkup.so)
- [Pi Documentation](https://pi.dev/docs)
- [Agent Skills Spec](https://agentskills.io/specification)

## License

MIT
