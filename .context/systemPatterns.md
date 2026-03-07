# System Patterns

## General Conventions
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- TypeScript strict mode everywhere — no `any` types
- Update `.context/progress.md` after completing tasks
- Reference `SPEC.md` for product requirements

## Naming
- MCP tools: `snake_case` (e.g. `analyze_repo`, `should_i_contribute`)
- TypeScript files: `kebab-case` (e.g. `bus-factor.ts`, `analyze-repo.ts`)
- Metric functions: `camelCase` exports (e.g. `computeBusFactor()`, `computeVerdict()`)
- UI panels: `kebab-case` HTML files (e.g. `verdict.html`)

## Architecture Patterns
- **Tools → Metrics separation**: Tools orchestrate data fetching and call pure metric functions. Metrics never fetch data.
- **Cache-through GitHub client**: All GitHub API calls go through cache. The client checks cache first, fetches on miss, stores result.
- **TTL-based cache**: Each endpoint type has a configured TTL. No manual invalidation — entries expire naturally.
- **UI via ext-apps**: Tools declare `_meta.ui.resourceUri` in their response. The host client fetches and renders the panel in a sandboxed iframe. Data flows via `postMessage` (JSON-RPC).

## Testing Patterns
- Metric modules: unit tests with fixture data (no real API calls)
- Tools: integration tests with mocked GitHub client
- Cache: test TTL expiration behavior with time manipulation
