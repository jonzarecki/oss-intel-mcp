# OSS Intelligence MCP Server — Roadmap

Post-MVP feature roadmap. Each phase builds on the previous one. Phases are roughly ordered by value and feasibility, not by strict timeline.

For the MVP scope, see [SPEC.md](SPEC.md).

---

## Phase 2: Supply Chain Intelligence

**Theme:** Extend analysis from a single repo to its entire dependency tree.

### Dependency Tree Risk Analysis
- Parse dependency manifests (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`) from the repository
- Recursively resolve transitive dependencies
- Run `analyze_repo` health checks against each dependency
- Produce a risk-ranked list: which dependencies are unmaintained, have high bus factor, or show declining activity

### "Dependency Risk" UI Panel
- Tree visualization of dependencies, color-coded by health verdict (green / yellow / red)
- Expandable nodes showing per-dependency health summary
- Aggregate risk score for the full dependency tree
- Highlight the riskiest transitive dependencies that the developer may not be aware of

### New MCP Tool
- `analyze_dependencies(owner, repo)` — Fetch manifest, resolve tree, return health of each dependency
- Heavy on API calls; requires aggressive caching and potentially background processing

---

## Phase 3: "Glassdoor for OSS"

**Theme:** Go beyond code metrics to measure what it's actually like to work with a project.

### Project Culture Score
- Composite metric (1–10) combining:
  - Maintainer tone: sentiment analysis on PR review comments (positive, neutral, harsh)
  - First-timer experience: how quickly first-time contributors get responses
  - Contributor retention: % of contributors who come back after their first PR
  - Review depth: average substantive comments per review (not just "LGTM")
- Requires NLP/sentiment analysis (likely via a lightweight local model or API)

### "OSS Drama Detector"
- Track maintainer departures (contributors who were active 6 months ago but have 0 activity in last 3 months)
- Detect spikes in negative sentiment on issues/PRs
- Flag sudden drops in commit activity or release cadence
- Alert-style UI panel with timeline of concerning events

### Historical Trends
- Store periodic snapshots of repo health metrics (weekly or monthly)
- SQLite or Postgres persistence for trend data
- "Health over time" line charts showing how bus factor, activity, PR health have evolved
- Detect inflection points: "This project started declining in Q3 2025"

---

## Phase 4: Distribution + Reach

**Theme:** Bring OSS intelligence to developers where they already are, beyond AI chat clients.

### Chrome Extension
- Sidebar that appears on any `github.com` repo page
- Shows the "Should I Use This?" card instantly
- Zero friction: no need to open an AI client or type a query
- Calls the MCP server (or a hosted API) for data
- Potential viral loop: developers see it, want it, install it

### GitHub Action
- Run as part of CI on pull requests
- Scans `package.json` / `requirements.txt` for new or changed dependencies
- Posts a PR comment with health verdicts for each added dependency
- Flags risky additions: "Warning: `left-pad` has a bus factor of 1 and no releases in 2 years"
- Configurable thresholds per repo

### Web Dashboard
- Standalone website (the original idea from the email thread)
- Enter a repo URL or GitHub org, get visual health reports
- Public and shareable: generates permalink reports
- SEO-friendly: "react health report", "kubernetes maintainer analysis"
- Monetization potential: free for public repos, paid for private/org-level analysis

---

## Phase 5: Platform

**Theme:** Scale from a tool to a platform for OSS intelligence.

### Augur / 8knot Integration
- Connect to CHAOSS-compliant data sources (Augur, 8knot, GrimoireLab)
- Access deeper metrics: contributor diversity, organizational diversity, time-to-close trends
- Cross-project analytics that individual GitHub API calls cannot provide
- Relevant for Red Hat OSPO use cases

### Multi-Project Portfolio View
- `analyze_org(org)` tool: "Show me the health of all repos in this GitHub org"
- Dashboard-style UI panel with sortable table of repos by health score
- Identify the weakest links in an organization's OSS portfolio
- Useful for OSPO teams monitoring hundreds of projects

### Custom Scoring
- Let enterprises define their own verdict weights
- Configuration file or API: "We care 40% about bus factor, 30% about corporate backing, 30% about release cadence"
- Different profiles for different use cases (security team vs engineering team vs OSPO)
- Store scoring profiles per-user or per-org

### GitHub App
- Register as a GitHub App for higher API rate limits (15,000 req/hr on Enterprise Cloud)
- Access to private repositories (enterprise customers)
- Webhook-driven: automatically re-analyze repos when activity changes
- Required for the GitHub Action and org-level portfolio features at scale

---

## Potential Future Explorations

Ideas that don't fit neatly into a phase but are worth tracking:

- **License compatibility checker**: Given a project's license, flag dependencies with incompatible licenses
- **Contributor recommendations**: "Based on your skills and interests, you should contribute to these repos"
- **OSS funding intelligence**: Integrate with OpenCollective, GitHub Sponsors, Tidelift to show funding health
- **Competitive landscape**: "Compare all service mesh projects" or "Show me the React ecosystem"
- **API / embeddable widget**: Let other tools and dashboards consume OSS intelligence data
- **Slack / Discord bot**: Post health alerts to team channels when a dependency's health changes
