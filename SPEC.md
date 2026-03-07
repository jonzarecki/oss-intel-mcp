# OSS Intelligence MCP Server — Product Specification

## Overview

An MCP server that provides AI-native open-source repository intelligence. Developers ask natural-language questions about OSS repositories and receive structured, visual answers directly inside their AI client (Cursor, Claude, VS Code Copilot, ChatGPT).

The server analyzes GitHub repositories to answer two fundamental questions:
1. **"Should I use this?"** — Is this dependency safe, maintained, and well-backed?
2. **"Should I contribute?"** — Will my PRs get reviewed? Is the community healthy?

## Target Personas

### Developer Evaluating a Dependency
- Considering adding a library to their project
- Needs to assess maintenance health, bus factor, corporate backing, and risk
- Currently relies on star count + "last commit date" — both poor proxies
- Wants a quick, trustworthy verdict without leaving their editor

### Developer Deciding Whether to Contribute
- Found a project they want to contribute to
- Wants to know if PRs actually get reviewed and merged
- Interested in maintainer responsiveness and community culture
- Needs to gauge whether contributing is worth the effort

## MCP Tools

### 1. `analyze_repo(owner, repo)`

The core tool. Produces a comprehensive health report with an overall verdict.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `owner` | string | yes | GitHub org or user (e.g. `"facebook"`) |
| `repo` | string | yes | Repository name (e.g. `"react"`) |

**Returns:** Structured JSON containing:
- **Verdict**: `"Safe to adopt"` / `"Use with caution"` / `"Risky"`
- **Verdict score**: 0–100 numeric score
- **Basic stats**: stars, forks, open issues, license, language, created date
- **Last release**: version, date, time since last release
- **Activity trend**: growing / stable / declining (with percentage change)
- **Bus factor**: score + top contributor concentration percentage
- **PR health**: merge rate, median time-to-merge, median time-to-first-review
- **Issue responsiveness**: median time-to-first-response, close rate
- **Release cadence**: average interval, regularity score
- **Corporate backing**: list of organizations with contribution share percentages
- **Top contributors**: name, org affiliation, commit count (top 10)

**UI panel:** "Should I Use This?" Card

### 2. `should_i_contribute(owner, repo)`

Contributor-focused analysis. Surfaces signals about community health and contribution experience.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `owner` | string | yes | GitHub org or user |
| `repo` | string | yes | Repository name |

**Returns:** Structured JSON containing:
- **PR acceptance rate**: percentage of PRs that get merged
- **Median time-to-merge**: how long a typical PR takes from open to merge
- **Median time-to-first-review**: how quickly maintainers respond to PRs
- **Recent maintainer activity**: last commit/review dates for top maintainers
- **"Good first issue" count**: number of issues tagged for newcomers
- **Contributor retention**: percentage of contributors who make >1 contribution
- **Code review culture signals**: average review comments per PR, review depth
- **Maintainer responsiveness score**: composite of review time + issue response time

**UI panel:** "Is It Worth Contributing?" Panel

### 3. `compare_repos(repos)`

Side-by-side comparison of 2–3 repositories on key metrics.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `repos` | `{owner: string, repo: string}[]` | yes | Array of 2–3 repo identifiers |

**Returns:** Structured JSON containing:
- Comparison table with rows for each metric, columns for each repo
- Per-repo verdicts
- Highlighted winner per metric
- Summary recommendation

**UI panel:** Reuses "Should I Use This?" Card in comparison layout

## UI Panels (MCP Apps / ext-apps)

Each tool declares a `_meta.ui.resourceUri` pointing to an HTML panel rendered in a sandboxed iframe via the MCP Apps extension (`@modelcontextprotocol/ext-apps`). Panels receive data from the tool via JSON-RPC over `postMessage`.

### Panel 1: "Should I Use This?" Card

The hero UI. Designed to be screenshotted and shared.

**Layout:**
- Large verdict badge at top: green (Safe), yellow (Caution), red (Risky)
- Verdict score (0–100) with contextual color
- Key stats grid (2×3): stars, last release, bus factor, PR merge rate, issue response time, release cadence
- 12-month commit activity sparkline
- Corporate backing summary (top 3 orgs with %)

**Trigger:** `analyze_repo` tool

### Panel 2: "Who Runs This Project?"

Deep dive into contributor distribution and corporate backing.

**Layout:**
- Top 10 contributors list with org affiliation badges and commit counts
- Horizontal bar chart: contribution distribution by person
- Pie chart: contribution share by organization
- Bus factor indicator with warning threshold (red if top 2 own >60%)

**Trigger:** `analyze_repo` tool (secondary panel)

### Panel 3: "Is It Worth Contributing?"

Contributor experience dashboard.

**Layout:**
- PR merge funnel visualization (opened → reviewed → merged, with drop-off %)
- Median review time gauge (fast / moderate / slow)
- Maintainer responsiveness score (1–10)
- "Good first issue" count with link-out
- Contributor retention bar (one-time vs repeat contributors)

**Trigger:** `should_i_contribute` tool

### Panel 4: "Corporate Backing"

Organization-level contribution analysis.

**Layout:**
- Pie chart of contributor affiliations by organization
- Table: org name, number of contributors, total commits, % of total
- Trend indicator: is corporate involvement growing or shrinking?
- "Independent" category for contributors without org affiliation

**Trigger:** `analyze_repo` tool (secondary panel)

## Computed Metrics

All metrics are derived from raw GitHub REST API data. No external data sources in MVP.

### Bus Factor
- **Method**: Gini coefficient of commit distribution among top contributors
- **Flag**: Warning if top 2 contributors own >60% of all commits
- **Output**: Score (0–1 where 0 = perfectly distributed, 1 = single contributor) + human-readable label

### Activity Trend
- **Method**: Compare commit volume in the last 3 months to the 3 months before that
- **Classification**: Growing (>15% increase), Stable (±15%), Declining (>15% decrease)
- **Output**: Trend label + percentage change

### PR Health
- **Method**: Analyze last 100 closed/merged PRs
- **Merge rate**: % of closed PRs that were merged (vs closed without merge)
- **Median time-to-merge**: From PR open to merge, in hours/days
- **Median time-to-first-review**: From PR open to first review comment or approval
- **Output**: Three numeric values + health label (healthy / moderate / concerning)

### Issue Responsiveness
- **Method**: Analyze last 100 closed issues
- **Median time-to-first-response**: From issue creation to first non-author comment
- **Close rate**: % of issues that get closed (vs staying open indefinitely)
- **Output**: Two numeric values + responsiveness label

### Release Cadence
- **Method**: Analyze time intervals between last 5 releases
- **Average interval**: Mean time between releases
- **Regularity score**: Standard deviation of intervals (low = predictable, high = erratic)
- **Output**: Average interval + regularity label (regular / irregular / stalled)

### Contributor Affiliation
- **Method**: For each of the top N contributors, fetch their GitHub user profile
- **Heuristics** (applied in priority order):
  1. `company` field on GitHub profile (most reliable)
  2. Email domain (if public email set)
  3. Bio text keyword matching (e.g. "Engineer at Google")
  4. Fall back to "Independent" if no signal
- **Normalization**: Canonicalize company names (e.g. "@google" → "Google", "Google LLC" → "Google")
- **Output**: Per-contributor org label + aggregated org-level contribution share

### Overall Verdict
- **Method**: Weighted composite score (0–100)
- **Weights**:
  - Activity trend: 25%
  - Bus factor: 20%
  - PR health: 20%
  - Issue responsiveness: 15%
  - Release cadence: 10%
  - Corporate backing: 10%
- **Mapping**:
  - 70–100: "Safe to adopt"
  - 40–69: "Use with caution"
  - 0–39: "Risky"
- **Output**: Verdict label + numeric score + per-metric breakdown

## GitHub API Usage

### Endpoints

| Metric | Endpoint | Cache TTL |
|--------|----------|-----------|
| Repo metadata | `GET /repos/{owner}/{repo}` | 5 min |
| Contributors | `GET /repos/{owner}/{repo}/contributors` | 1 hour |
| Commit activity | `GET /repos/{owner}/{repo}/stats/commit_activity` | 6 hours |
| Code frequency | `GET /repos/{owner}/{repo}/stats/code_frequency` | 6 hours |
| Recent PRs | `GET /repos/{owner}/{repo}/pulls?state=closed&sort=updated&per_page=100` | 1 hour |
| Recent issues | `GET /repos/{owner}/{repo}/issues?state=closed&sort=updated&per_page=100` | 1 hour |
| Releases | `GET /repos/{owner}/{repo}/releases?per_page=10` | 1 hour |
| User profiles | `GET /users/{username}` | 24 hours |

### Rate Limit Strategy

- **Authenticated requests**: 5,000/hr with a GitHub personal access token
- **Caching**: SQLite-backed TTL cache (`better-sqlite3`). Stats and contributor data cached for hours; repo metadata for minutes. Eliminates redundant calls when the same repo is analyzed multiple times.
- **Stats endpoint retry**: GitHub stats endpoints return `202 Accepted` on cache miss and compute in background. The client retries after 2 seconds (up to 3 retries).
- **User profile batching**: Affiliation lookups are the most API-expensive operation (1 call per contributor). Limit to top 20 contributors per repo. Cache aggressively (24hr TTL) since profiles rarely change.

### Estimated API Cost Per Repo Analysis

| Call | Requests |
|------|----------|
| Repo metadata | 1 |
| Contributors | 1 |
| Commit activity | 1–2 (retry) |
| Code frequency | 1–2 (retry) |
| PRs | 1 |
| Issues | 1 |
| Releases | 1 |
| User profiles | up to 20 |
| **Total** | **~27 requests** (uncached) |

With caching, repeat analyses of the same repo cost 0–2 requests (only expired entries refreshed).

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | Node.js + TypeScript (strict) | MCP SDK is TS-native |
| MCP SDK | `@modelcontextprotocol/sdk` | Official MCP server SDK |
| MCP Apps | `@modelcontextprotocol/ext-apps` v1.1.2 | Official UI extension (stable) |
| GitHub client | `octokit/rest` | Official SDK, handles auth + rate limits + pagination |
| Caching | SQLite via `better-sqlite3` | Zero-config, embedded, fast synchronous reads |
| UI charting | Vanilla JS + inline SVG | Panels must be self-contained HTML; no external CDN deps |
| Testing | Vitest | Fast, TS-native |
| Linting | Biome | Fast, opinionated |

## Project Structure

```
oss-intel-mcp/
  package.json
  tsconfig.json
  biome.json
  src/
    index.ts                # MCP server entry point, tool registration
    tools/
      analyze-repo.ts       # analyze_repo tool implementation
      should-contribute.ts  # should_i_contribute tool implementation
      compare-repos.ts      # compare_repos tool implementation
    github/
      client.ts             # Octokit wrapper with rate-limit handling + retry
      types.ts              # GitHub API response types
    cache/
      store.ts              # SQLite-backed TTL cache
      keys.ts               # Cache key generation per endpoint
    metrics/
      bus-factor.ts         # Gini coefficient of commit distribution
      activity-trend.ts     # 3-month commit volume comparison
      pr-health.ts          # PR merge rate, review time analysis
      issue-health.ts       # Issue responsiveness metrics
      release-cadence.ts    # Release interval + regularity
      affiliation.ts        # Contributor → org mapping heuristics
      verdict.ts            # Weighted composite score + verdict
    ui/
      panels/
        verdict.html              # Overall health verdict with score breakdown
        bus-factor.html           # Contributor concentration risk
        responsiveness.html      # PR/issue health
        activity-pulse.html       # Commit activity trend
        corporate-backing.html    # Elephant factor + org breakdown
        security.html             # OpenSSF security score
        comparison.html           # Side-by-side repo comparison
      shared/
        styles.css                # Shared panel styles
        charts.ts                 # SVG sparkline/bar/pie chart utilities
  tests/
    metrics/                # Unit tests for each metric module
    tools/                  # Integration tests for tool endpoints
  SPEC.md
  ROADMAP.md
```

## Client Compatibility

MCP Apps (ext-apps) is supported in:
- Cursor (v2.6+)
- Claude Desktop
- VS Code (GitHub Copilot)
- ChatGPT
- Goose
- Postman
- MCPJam

All tools also return structured JSON text, so they degrade gracefully in clients that don't support MCP Apps — the AI can still present the data as formatted text.

## Out of Scope (MVP)

See ROADMAP.md for deferred features. Explicitly excluded from MVP:
- Dependency tree analysis
- Sentiment analysis / culture scoring
- Historical trend storage
- Chrome extension / GitHub Action / web dashboard
- Augur/8knot integration
- Private repository support
- Multi-org portfolio views
- Custom scoring weights
