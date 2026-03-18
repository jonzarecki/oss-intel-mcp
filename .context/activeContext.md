# Active Context

## Current Focus
Fixing affiliation detection bugs (Issues #1, #5, #6). Improving corporate contributor identification accuracy.

## Status
- Full MVP: 3 tools, 7 focused UI panels, 8 metrics, cache layer
- Affiliation now uses 7-signal chain: repo-org membership > commit email (with personal domain filter) > company field > corporate org membership > profile email > OSS Insight > bio parsing
- GitHub API client with Octokit, caching, retry, rate limit tracking
- `getUserOrgs` endpoint added for org membership detection (24h cache)
- 3 external enrichment APIs (deps.dev, OpenSSF Scorecard, OSS Insight)
- HTTP transport on port 9847 with --stdio fallback
- Docker support, CI pipeline, 114 tests passing
- TypeScript strict mode clean

## What's Done
- Affiliation detection overhaul: repo-org signal, corporate org signal, personal domain filter, bio @org parsing
- Rate-limit guard for org API calls
- Scenario tests for exo-explore/exo and kagenti/kagenti repos
- Activity trend fallback: Commits API fallback when stats endpoint returns empty or stale data

## What's Next
- Remaining GitHub issues: #4 (issue close rate), #7 (review depth)
- npm publish
- MCP directory submissions
