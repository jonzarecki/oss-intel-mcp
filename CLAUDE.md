# OSS Intelligence MCP Server

MCP server providing AI-native open-source repository intelligence with interactive UI panels. Developers ask questions about OSS repos and get structured, visual answers inside their AI client.

## Quick start

No runtime code yet. See `SPEC.md` for the product spec and `ROADMAP.md` for post-MVP features.

```bash
# Once scaffolded:
pnpm install
pnpm dev          # start MCP server in dev mode
pnpm test         # run vitest
pnpm typecheck    # strict TS check
pnpm lint         # biome check
```

## Build & test

```bash
pnpm build        # compile TypeScript
pnpm test         # unit + integration tests (vitest)
pnpm typecheck    # TypeScript strict check
pnpm lint         # biome lint
pnpm lint:fix     # auto-fix lint issues
```

## Architecture

- MCP server (TypeScript) exposing 3 tools: `analyze_repo`, `should_i_contribute`, `compare_repos`
- 4 interactive UI panels via MCP Apps (`@modelcontextprotocol/ext-apps`)
- GitHub REST API as sole data source, wrapped with Octokit
- SQLite caching layer (`better-sqlite3`) for rate-limit management
- See `ARCH.md` for full architecture and file tree
- See `SPEC.md` for detailed product spec
- See `ROADMAP.md` for post-MVP phases

## Non-negotiables

- TypeScript strict mode everywhere — no `any` types
- Every new module must have corresponding tests
- Reference `SPEC.md` for product requirements
- UI panels must be self-contained HTML (no external CDN deps)
- All GitHub API calls go through the caching layer

## How to work here

- Small incremental commits with conventional messages (`feat:`, `fix:`, `refactor:`, etc.)
- MCP tools → `src/tools/`
- GitHub API client → `src/github/`
- Metric computations → `src/metrics/`
- UI panels → `src/ui/panels/`
- Cache layer → `src/cache/`
- Tests → `tests/`
- Update `.context/progress.md` after completing tasks
- Update `.context/activeContext.md` when switching focus
- Run `/status` to see current project state
- Run `/plan` to decide what to work on next
- Run `/review` before committing

## Forbidden patterns

- No `any` types
- No `console.log` in committed code (use proper logging)
- No direct GitHub API calls outside `src/github/client.ts`
- No external CDN dependencies in UI panels
- No new top-level folders without updating ARCH.md
