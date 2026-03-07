# Tech Context

## Stack
- Language: TypeScript (strict mode)
- Runtime: Node.js
- MCP SDK: `@modelcontextprotocol/sdk`
- MCP Apps: `@modelcontextprotocol/ext-apps` v1.1.2
- GitHub client: `@octokit/rest`
- Caching: SQLite via `better-sqlite3` (synchronous, embedded)
- UI: Self-contained HTML panels with inline SVG charts
- Testing: Vitest
- Linting: Biome

## Key Technical Decisions Made
- SQLite for caching (not Redis) — zero infrastructure, single-process local MCP server
- `better-sqlite3` synchronous API — simpler control flow, no async cache access
- Self-contained HTML panels — no external CDN deps allowed in sandboxed iframes
- `@octokit/rest` over raw fetch — handles auth, pagination, rate-limit headers
- Top 20 contributors max for affiliation lookups — balances API cost vs coverage
- Metric modules are pure functions — no side effects, trivially testable

## Key Technical Decisions Pending
- Build tooling: esbuild vs tsc for compilation
- MCP server transport: stdio vs HTTP (stdio is standard for local MCP servers)
- SVG chart approach: hand-rolled vs tiny library bundled inline
- Cache database location: `~/.oss-intel-mcp/cache.db` vs project-local
