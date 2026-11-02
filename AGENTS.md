# pi-linkup

Public Pi extension providing web search, answer, and fetch tools via the Linkup API. People could be using this, so consider backwards compatibility when making changes.

Check Pi release notes and extension contracts when updating the host SDK. Keep host-provided SDK packages and TypeBox in optional peer dependencies, with exact development versions for reproducible checks.

## Stack

- TypeScript (strict mode)
- pnpm 10.26.1
- Biome for linting/formatting
- Changesets for versioning

## Scripts

```bash
pnpm typecheck    # Type check
pnpm lint         # Lint (runs on pre-commit)
pnpm format       # Format
pnpm changeset    # Create changeset for versioning
```

## Structure

```
src/
  client.ts       # Linkup API client
  types.ts        # Response schemas, derived types, and pricing
  extensions/     # Independent tool and balance-command entries
  lib/            # Environment, initialization, output, and usage helpers
tests/            # Client, tool, and Pi runtime checks
skills/
  linkup/SKILL.md # Skill docs for agents using this extension
```

## Conventions

- New tools: follow patterns in `src/extensions/`
- Keep model-facing previews separate from structured data and protect spill files
- `pnpm test` exercises real tools at the HTTP boundary and Pi extension loading
- API keys come from environment (`LINKUP_API_KEY`)
- Update `skills/linkup/SKILL.md` when tool behavior changes

## Versioning

Uses changesets. Run `pnpm changeset` before committing user-facing changes.

- `patch`: bug fixes
- `minor`: new features/tools
- `major`: breaking changes
