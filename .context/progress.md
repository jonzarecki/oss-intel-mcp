# Progress

## Session 0 — Planning & Scaffolding
- Wrote product spec (SPEC.md): 3 tools, 4 UI panels, 7 computed metrics, GitHub API strategy
- Wrote post-MVP roadmap (ROADMAP.md): Phases 2–5 (supply chain, Glassdoor for OSS, distribution, platform)
- Scaffolded AI-native tooling: CLAUDE.md, ARCH.md, TASKS.md, .claude/, .cursor/, .context/

## Session 1 — Full MVP Implementation
- Phase 1: Project scaffolding (package.json, tsconfig.json, biome.json, vitest.config.ts, tsup.config.ts)
- Phase 2: SQLite TTL cache layer (src/cache/store.ts, src/cache/keys.ts) — 18 tests
- Phase 3: GitHub client (Octokit wrapper with cache-through + retry) + 3 external API clients (deps.dev, OpenSSF Scorecard, OSS Insight) with graceful degradation — 18 tests
- Phase 4: 8 metric modules as pure functions (bus factor, activity trend, PR health, issue health, release cadence, affiliation, security, verdict) — 42 tests
- Phase 5: 3 MCP tools (analyze_repo, should_i_contribute, compare_repos) with tool registration via ext-apps — 3 integration tests
- Phase 6: 4 self-contained HTML UI panels (should-i-use, who-runs-this, contribution-worth, corporate-backing) with inline SVG charts
- Phase 7: Full server wiring in index.ts, README.md with setup instructions
- Total: 17 test files, 81 tests passing, TypeScript strict mode clean, 44KB bundled output

## Session 2 — Testing & Transport
- Added E2E test suite over stdio (4 tests against real repos: expressjs/express, fastify/fastify)
- Added test scripts: test:unit, test:e2e, test:all, test:ci
- Created GitHub Actions CI workflow (.github/workflows/ci.yml)
- Fixed biome lint formatting (62 errors resolved)
- Switched from stdio to Streamable HTTP transport (port 9847) with --stdio fallback flag
- Created Dockerfile (multi-stage Node 22 build) and .dockerignore
- Updated E2E tests to use HTTP StreamableHTTPClientTransport
- Verified Docker build + container run
- Total: 18 test files, 85 tests passing (81 unit + 4 E2E)

## Session 3 — Polish & Validation
- Updated TASKS.md to reflect all completed work
- Updated .context/ docs to current state

## Session 4 — Metrics & Affiliation Refinement
- Rewrote affiliation detection: multi-signal resolver (commit email > profile > OSS Insight > bio)
- Implemented Elephant Factor metric (minimum companies for 50% of commits)
- Expanded domain lists (~75 well-known, ~30 free email, ~80 canonical companies)
- Fixed Issue Responsiveness: close rate + backlog penalty for high open issue counts
- Fixed Activity Trend: 0/0 commits correctly reports "declining"
- Updated affiliation scoring to tiered system based on Elephant Factor
- Added `getRecentCommitEmails` to GitHub client for commit-weighted org detection
- Created corporate affiliation methodology doc
- All 94 tests passing

## Session 5 — Focused Panel Redesign
- Redesigned 4 full-page dashboards into 7 focused inline cards (max 500px height)
- New panels: verdict, responsiveness, activity-pulse, bus-factor, corporate-backing, security, comparison
- All panels use host CSS variables with dark-mode fallbacks
- Skeleton loading states replace spinners
- Responsive down to 320px width, 4-5 data points per card
- Updated register.ts with new tool-to-panel mappings

## Session 6 — App-Bridge Migration
- Migrated panels from inline scripts to TypeScript modules bundled by Vite
- Created LiteApp: lightweight ext-apps protocol handler (~2KB vs ~400KB for full SDK)
- Shared module with common helpers (esc, fmt, scoreColor, etc.)
- Added `ontoolinputpartial` support: panels show repo name during tool execution
- Added `onhostcontextchanged`: auto-applies host theme, CSS variables, fonts
- Build pipeline: tsup (server) + Vite/vite-plugin-singlefile (panels)
- Panel sizes: 6-9KB each (self-contained HTML)
- 98 tests passing, typecheck clean

## Session 7 — Affiliation Detection Overhaul (Issues #1, #5, #6)
- Added `getUserOrgs` to GitHub client (`GET /users/{login}/orgs`, 24h cache TTL)
- New signal: repo-owner org membership (highest priority) — fixes academic affiliation masking employer
- New signal: known corporate org membership — resolves empty company fields via GitHub org data
- Personal domain detection: commit emails from vanity domains (e.g. `hillion.dev`) no longer misattributed as corporate
- Improved bio parsing: founder patterns, `@org` GitHub mentions, cross-reference with repo owner
- Fixed dead OSS Insight lookup (was keyed by org_name but looked up by login — never matched)
- Extended `AffiliationInput` with `userOrgs`, `repoOwner`, `userNames` for richer signal chain
- Rate-limit guard: skips org fetches when remaining API calls < 50
- Wired org data into both `analyze-repo` and `should-contribute` tools
- 20 new tests covering all new signals, personal domain filtering, bio patterns, and full scenario tests for exo-explore/exo and kagenti/kagenti
- 114 tests passing (up from 94), typecheck clean

## Session 8 — Activity Trend Fallback (Issue #3)
- Added `getCommitCountsFallback` to GitHub client: paginates `GET /repos/.../commits?since=DATE`, groups by ISO week, caches for 6h
- Added `needsActivityFallback` helper with two-mode detection: "full" (empty stats) and "supplement" (stale recent weeks)
- Wired fallback into `analyze-repo.ts`: full replacement when stats is empty, recent-window supplement when last 13 weeks are zeros
- Sanity check: fallback only triggers when `pushed_at` is within last 6 months (skip for truly abandoned repos)
- Rate-limit aware: full fallback up to 10 pages, supplement up to 5 pages; skipped for old repos
- Added `enrichmentSources: "github-commits-fallback"` when the fallback provides data
- 9 new tests covering fallback method, `needsActivityFallback` helper, and integration trigger
- 123 tests passing (up from 114), typecheck clean
