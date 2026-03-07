# Architecture

## Overview

An MCP server that analyzes GitHub repositories and returns structured health reports with interactive UI panels. The server exposes 3 tools over the Model Context Protocol, computes 7 derived metrics from raw GitHub API data, caches responses in SQLite, and renders 4 visual panels via the MCP Apps extension.

## File Tree

```
oss-intel-mcp/
├── package.json
├── tsconfig.json
├── biome.json
├── CLAUDE.md
├── SPEC.md
├── ARCH.md
├── TASKS.md
├── ROADMAP.md
├── .context/
│   ├── activeContext.md
│   ├── progress.md
│   ├── techContext.md
│   └── systemPatterns.md
├── .claude/
│   ├── settings.json
│   ├── hooks/
│   │   └── protect-files.sh
│   ├── commands/
│   │   ├── status.md
│   │   ├── plan.md
│   │   └── review.md
│   └── skills/
│       ├── review/SKILL.md
│       ├── commit-changes/SKILL.md
│       └── implement-plan/SKILL.md
├── .cursor/
│   └── rules/
│       └── standards.mdc
├── src/
│   ├── index.ts                    # MCP server entry, tool registration
│   ├── tools/
│   │   ├── analyze-repo.ts         # analyze_repo tool
│   │   ├── should-contribute.ts    # should_i_contribute tool
│   │   └── compare-repos.ts        # compare_repos tool
│   ├── github/
│   │   ├── client.ts               # Octokit wrapper, rate-limit handling, retry
│   │   └── types.ts                # GitHub API response types
│   ├── cache/
│   │   ├── store.ts                # SQLite-backed TTL cache
│   │   └── keys.ts                 # Cache key generation per endpoint
│   ├── metrics/
│   │   ├── bus-factor.ts           # Gini coefficient of commit distribution
│   │   ├── activity-trend.ts       # 3-month commit volume comparison
│   │   ├── pr-health.ts            # PR merge rate, review time
│   │   ├── issue-health.ts         # Issue responsiveness
│   │   ├── release-cadence.ts      # Release interval + regularity
│   │   ├── affiliation.ts          # Contributor → org mapping heuristics
│   │   └── verdict.ts              # Weighted composite score + verdict
│   └── ui/
│       ├── panels/
│       │   ├── verdict.html              # Overall health verdict with score breakdown
│       │   ├── bus-factor.html           # Contributor concentration risk
│       │   ├── responsiveness.html       # PR/issue health
│       │   ├── activity-pulse.html       # Commit activity trend
│       │   ├── corporate-backing.html    # Elephant factor + org breakdown
│       │   ├── security.html             # OpenSSF security score
│       │   └── comparison.html           # Side-by-side repo comparison
│       └── shared/
│           ├── styles.css                # Shared panel styles
│           └── charts.ts                 # SVG sparkline/bar/pie utilities
└── tests/
    ├── metrics/                    # Unit tests per metric module
    └── tools/                      # Integration tests for tool endpoints
```

## Components

### MCP Server (`src/index.ts`)
Entry point. Registers 3 tools with the MCP SDK, wires up UI resource URIs for ext-apps panels, and starts the server.

### Tools (`src/tools/`)
Each tool fetches data via the GitHub client, runs it through metric computations, and returns structured JSON + a `_meta.ui.resourceUri` pointing to the appropriate panel.

| Tool | Purpose | UI Panel |
|------|---------|----------|
| `analyze_repo` | Full health report with verdict | "Should I Use This?" + "Who Runs This?" + "Corporate Backing" |
| `should_i_contribute` | Contributor experience analysis | "Is It Worth Contributing?" |
| `compare_repos` | Side-by-side comparison | Comparison layout of verdict cards |

### GitHub Client (`src/github/`)
Thin wrapper around `@octokit/rest`. Responsibilities:
- Authentication (GitHub PAT from env)
- Rate-limit awareness (respect `X-RateLimit-Remaining`)
- Retry logic for stats endpoints (handle `202 Accepted` with background computation)
- All calls go through the cache layer before hitting the API

### Cache (`src/cache/`)
SQLite-backed TTL cache using `better-sqlite3`. Stores serialized API responses keyed by endpoint + params. Each entry has a TTL (configured per endpoint type). Cache is checked before every GitHub API call; expired entries trigger a fresh fetch.

| Data type | TTL |
|-----------|-----|
| Repo metadata | 5 min |
| Contributors | 1 hour |
| Commit stats | 6 hours |
| PRs / Issues | 1 hour |
| Releases | 1 hour |
| User profiles | 24 hours |

### Metrics (`src/metrics/`)
Pure functions that take GitHub API response data and return computed metrics. No side effects, no API calls — easy to test.

| Module | Input | Output |
|--------|-------|--------|
| `bus-factor` | Contributor commit counts | Gini coefficient, concentration warning |
| `activity-trend` | Weekly commit activity | Trend label (growing/stable/declining), % change |
| `pr-health` | Closed PRs list | Merge rate, median time-to-merge, median review time |
| `issue-health` | Closed issues list | Median response time, close rate |
| `release-cadence` | Releases list | Average interval, regularity score |
| `affiliation` | User profiles | Contributor → org mapping, org contribution shares |
| `verdict` | All metric outputs | Weighted composite score (0–100), verdict label |

### UI Panels (`src/ui/`)
Self-contained HTML files rendered in sandboxed iframes via MCP Apps. Each panel receives data via `postMessage` (JSON-RPC) from the host client. Charts are drawn with inline SVG — no external dependencies.

## Data Flow

```
User asks question in AI client
        ↓
AI client invokes MCP tool (e.g. analyze_repo)
        ↓
Tool → GitHub Client → Cache check
        ↓                    ↓
   Cache hit              Cache miss → GitHub REST API → Store in cache
        ↓                    ↓
     Raw API data (merged)
        ↓
   Metric computations (bus factor, PR health, etc.)
        ↓
   Verdict computation (weighted composite)
        ↓
   Structured JSON response + _meta.ui.resourceUri
        ↓
AI client renders text response + interactive UI panel
```

## Key Design Decisions

- **SQLite for caching** (not Redis): Zero infrastructure — the MCP server is a single process that developers run locally. SQLite via `better-sqlite3` is synchronous, embedded, and requires no setup.
- **Self-contained HTML panels**: UI panels cannot rely on external CDNs because they run in sandboxed iframes. All CSS and JS must be inline or bundled.
- **Pure metric functions**: Metric modules are pure functions (data in → result out) with no side effects. This makes them trivially testable and composable.
- **Octokit for GitHub**: The official SDK handles auth, pagination, and rate-limit headers. No reason to use raw `fetch`.
