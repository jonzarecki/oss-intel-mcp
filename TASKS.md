# Tasks

## Completed
- [x] Write product spec (SPEC.md)
- [x] Write post-MVP roadmap (ROADMAP.md)
- [x] Scaffold AI-native tooling (CLAUDE.md, ARCH.md, .claude/, .cursor/, .context/)
- [x] Initialize project: package.json, tsconfig.json, biome.json, dependencies
- [x] Set up MCP server entry point (`src/index.ts`) with tool registration
- [x] Implement SQLite cache layer (`src/cache/store.ts`, `src/cache/keys.ts`)
- [x] Implement GitHub API client wrapper (`src/github/client.ts`, `src/github/types.ts`)
- [x] Implement 3 external API clients (deps.dev, OpenSSF Scorecard, OSS Insight)
- [x] Implement bus factor computation (`src/metrics/bus-factor.ts`)
- [x] Implement activity trend analysis (`src/metrics/activity-trend.ts`)
- [x] Implement PR health metrics (`src/metrics/pr-health.ts`)
- [x] Implement issue responsiveness metrics (`src/metrics/issue-health.ts`)
- [x] Implement release cadence analysis (`src/metrics/release-cadence.ts`)
- [x] Implement contributor affiliation heuristics (`src/metrics/affiliation.ts`)
- [x] Implement security score from OpenSSF Scorecard (`src/metrics/security.ts`)
- [x] Implement verdict computation (`src/metrics/verdict.ts`)
- [x] Implement `analyze_repo` tool (`src/tools/analyze-repo.ts`)
- [x] Implement `should_i_contribute` tool (`src/tools/should-contribute.ts`)
- [x] Implement `compare_repos` tool (`src/tools/compare-repos.ts`)
- [x] Build 4 self-contained HTML UI panels with inline SVG charts
- [x] Unit tests for all metric modules (42 tests)
- [x] Integration tests for tool endpoints (3 tests)
- [x] Test cache TTL behavior and expiration (18 tests)
- [x] E2E tests over HTTP with real API calls (4 tests)
- [x] Write README.md with setup instructions and MCP client configuration
- [x] Switch to Streamable HTTP transport (port 9847) with --stdio fallback
- [x] Create Dockerfile and .dockerignore
- [x] Set up GitHub Actions CI workflow
- [x] Fix biome lint formatting issues

## In Progress
- [ ] Polish: structured logging with LOG_LEVEL env var
- [ ] Polish: GET /health endpoint for Docker health checks
- [ ] Polish: Rate limit visibility in tool responses
- [ ] Polish: Edge case hardening (large, small, archived, empty repos)
- [ ] Polish: UI panel visual validation in Cursor/Claude Desktop

## Follow-up Ideas
- [ ] Dependency tree risk analysis (Phase 2 — see ROADMAP.md)
- [ ] Project culture score / "Glassdoor for OSS" (Phase 3)
- [ ] Chrome extension for GitHub sidebar (Phase 4)
- [ ] GitHub Action for dependency PR checks (Phase 4)
- [ ] Web dashboard for non-AI-client users (Phase 4)
