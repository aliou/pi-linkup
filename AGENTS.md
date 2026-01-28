# pi-linkup

Public Pi extension providing web search, answer, and fetch tools via the Linkup API. People could be using this, so consider backwards compatibility when making changes.

Pi is pre-1.0.0, so breaking changes can happen between Pi versions. This extension must stay up to date with Pi or things will break.

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
  index.ts        # Extension entry, registers tools and commands
  client.ts       # Linkup API client
  types.ts        # Shared types
  tools/          # Tool implementations
  commands/       # Command implementations
skills/
  linkup/SKILL.md # Skill docs for agents using this extension
```

## Conventions

- New tools: follow patterns in `src/tools/`
- API keys come from environment (`LINKUP_API_KEY`)
- Update `skills/linkup/SKILL.md` when tool behavior changes

## Versioning

Uses changesets. Run `pnpm changeset` before committing user-facing changes.

- `patch`: bug fixes
- `minor`: new features/tools
- `major`: breaking changes
