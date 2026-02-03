# pi-linkup

Web search and content fetching extension for [Pi](https://buildwithpi.ai/) using the [Linkup API](https://linkup.so).



## Features

- `linkup_web_search` - Search the web, get relevant sources with content
- `linkup_web_answer` - Get synthesized answers with citations
- `linkup_web_fetch` - Extract clean markdown from URLs
- `/linkup:balance` - Check API credit balance


https://github.com/user-attachments/assets/a0f131a4-d57c-4162-aeb5-ffc1a0a8d7ff


## Installation

### Get API Key

Sign up at [app.linkup.so](https://app.linkup.so) to get an API key.

### Set Environment Variable

```bash
export LINKUP_API_KEY="your-api-key-here"
```

Add to shell profile for persistence:

```bash
echo 'export LINKUP_API_KEY="your-api-key-here"' >> ~/.zshrc
```

### Install Extension

```bash
# From npm
pi install npm:@aliou/pi-linkup

# From git
pi install git:github.com/aliou/pi-linkup

# Local development
pi -e ./src/index.ts
```

## Usage

### linkup_web_search

Search the web and get a list of sources with content snippets.

**Parameters:**
- `query` (string, required) - The search query
- `deep` (boolean, optional) - Use deep search mode for comprehensive results. Default: false

**Example prompts:**
```
Search for "TypeScript 5.0 new features"
```

```
Use linkup_web_search with deep mode to research WebAssembly WASI
```

The agent will use `linkup_web_search` to find relevant sources. Results are shown in compact view by default. Press `Ctrl+O` to expand and see all sources with full content.

### linkup_web_answer

Get a synthesized answer with sources.

**Parameters:**
- `query` (string, required) - The question to answer
- `deep` (boolean, optional) - Use deep search mode. Default: false

**Example prompts:**
```
What is the latest stable Node.js version?
```

```
Use linkup_web_answer to find Microsoft's 2024 revenue
```

The agent will use `linkup_web_answer` for concise answers. Press `Ctrl+O` to expand and see the full answer with all sources.

### linkup_web_fetch

Fetch content from a specific URL as markdown.

**Parameters:**
- `url` (string, required) - The URL to fetch
- `renderJs` (boolean, optional) - Render JavaScript. Default: true

**Example prompts:**
```
Fetch the content from https://docs.linkup.so
```

```
Use linkup_web_fetch without JavaScript rendering for https://example.com/docs
```

The agent will use `linkup_web_fetch` to extract clean markdown. Press `Ctrl+O` to expand and see more content.

### Check Balance

```
/linkup:balance
```

Shows remaining API credits.

## Skill

Includes agentskills.io compliant skill with detailed usage guide:

```
/skill:linkup
```

Provides:
- Tool selection guidance
- Query formulation tips
- When to use deep vs standard search
- Prompting best practices
- Example workflows

## Tool Selection Guide

**Use linkup_web_search when:**
- Finding information across multiple sources
- Research and discovery
- Need to see different perspectives

**Use linkup_web_answer when:**
- Need a direct answer to a specific question
- Want a quick summary from multiple sources
- Time-sensitive queries

**Use linkup_web_fetch when:**
- Reading documentation from a known URL
- Following up on search results
- Extracting content from specific articles

## Best Practices

1. Be specific with queries: "Microsoft 2024 Q4 revenue" beats "Microsoft revenue"
2. Use deep mode strategically: Deep searches are thorough but slower
3. Choose the right tool: search for discovery, answer for facts, fetch for known URLs
4. Monitor usage: Check `/linkup:balance` to track credit consumption

## Development

### Setup

```bash
git clone https://github.com/aliou/pi-linkup.git
cd pi-linkup

# Install dependencies (sets up pre-commit hooks)
pnpm install
```

Pre-commit hooks run on every commit:
- TypeScript type checking
- Biome linting
- Biome formatting with auto-fix

### Commands

```bash
# Type check
pnpm run typecheck

# Lint
pnpm run lint

# Format
pnpm run format
```

### Test Locally

```bash
pi -e ./src/index.ts

# Then in Pi
/skill:linkup
```

## Requirements

- Pi coding agent v0.50.0+
- LINKUP_API_KEY environment variable

## Links

- [Linkup Documentation](https://docs.linkup.so)
- [Linkup API Reference](https://docs.linkup.so/pages/documentation/api-reference)
- [Get API Key](https://app.linkup.so)
- [Pi Documentation](https://buildwithpi.ai/)
- [Agent Skills Spec](https://agentskills.io/specification)

## License

MIT
