# pi-linkup

Published Pi extension for Linkup web tools. Preserve released tool names, defaults, and result fields; calls can spend users' API credits.

- Do not make billed API calls in tests or verification without explicit authorization. Use controlled HTTP responses.
- When updating Pi dependencies, check upstream extension contracts and run the real extension-loading tests. Keep host SDK packages and TypeBox in optional peers, with exact development versions.
- Keep display previews separate from complete structured results. Spill files must remain private.
- Tool exposure is global and read during extension registration; project files must not control it.
- Add a Changeset for user-facing changes.
- When tool behavior changes, update README.md and skills/linkup/SKILL.md. Keep the README focused on onboarding and the skill focused on agent workflows.
