# AGENTS.md

## Learned User Preferences

- Prefer HTTP transport over stdio for MCP servers; enables Docker support and feels cleaner
- Use non-default ports (e.g. 9847) rather than common ones like 3000/8080
- Commit-weighted affiliation is the preferred method for corporate backing metrics
- No manual data sources or LinkedIn for corporate affiliation detection; automated signals only
- UI panels for MCP Apps should be focused and compact, not full HTML pages
- Follow a plan-then-implement workflow: propose plan → user reviews/edits → implement without editing the plan file
- Validate metrics with E2E tests against real repos (e.g. expressjs/express) to sanity-check scores
- Corporate affiliation accuracy is a high-priority concern; surface oddities proactively
- Use `gh` CLI for GitHub operations in this workspace; the GitHub MCP server has credential issues
- Use `gh auth token` to get a working GitHub PAT (fine-grained PATs from MCP config may expire)
- Reference `wa-mcp` project for patterns on bash demos, repo comparison, and test approaches
- Keep each PR/change small and incremental per conventional commits

## Learned Workspace Facts

- Stack: TypeScript strict mode, pnpm, vitest, biome, tsup (esbuild), Octokit
- Transport: Streamable HTTP on port 9847 (overridable via PORT env), with `--stdio` fallback
- External enrichment APIs: deps.dev, OpenSSF Scorecard, OSS Insight — all optional with graceful degradation
- Cache: SQLite at `~/.oss-intel/cache.db` with per-endpoint TTLs (24h user profiles, 1h contributors/PRs/issues, 6h commit stats)
- GitHub stats endpoints return 202 on first call; do not cache empty results from 202 retries
- OSS Insight lookup in affiliation is currently dead code (keyed by org_name but looked up by login)
- Affiliation uses multi-signal resolution: commit email → company field → profile email → OSS Insight → bio parsing
- Known affiliation gaps: no org membership signal, personal vanity domains treated as corporate, bio @org mentions not parsed
- 98+ tests across 17+ files; E2E tests require GITHUB_TOKEN and network access
- Docker support exists for the HTTP transport mode
- UI panels use MCP Apps ext-apps with app-bridge; self-contained HTML with inline SVG charts
- Verdict weights: Activity 20%, Bus Factor 17%, PR Health 17%, Security 17%, Issue Health 13%, Release Cadence 8%, Affiliation 8%
