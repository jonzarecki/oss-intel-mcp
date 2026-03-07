# Corporate Affiliation Detection — Background and Methodology

## The Problem

Determining which company a contributor works for is one of the hardest problems in open source analytics. There is no single authoritative source, and every approach has trade-offs between accuracy, coverage, and scalability.

## How the Industry Identifies Corporate Affiliation

### Signal 1: Git Commit Email Domain (strongest automated signal)

Every git commit stores the author's email in its metadata. If someone commits with `alice@google.com`, you know they were at Google when they made that commit.

**Strengths:**
- Set at commit time — reflects employer *when the work was done*
- Corporate laptops/environments often enforce corporate email
- Survives even if the user changes their GitHub profile later
- Available via `GET /repos/{owner}/{repo}/commits` API

**Weaknesses:**
- Many developers use `@gmail.com` or GitHub's `noreply` addresses (~50-70% of commits)
- Doesn't distinguish personal-time contributions from work-sponsored ones
- Can be stale if someone changes jobs mid-project

**Used by:** CNCF DevStats, GrimoireLab, Linux kernel gitdm

### Signal 2: GitHub Profile `company` Field

The `user.company` field from the GitHub Users API. Self-reported by the user.

**Strengths:**
- Directly accessible via API
- Explicit intent — user chose to display their employer

**Weaknesses:**
- Only ~5.6% of GitHub users fill this in (per OSS Insight's own data)
- Stale — people forget to update after job changes
- Dirty data: job titles ("Head of Product PostHog"), locations ("Tokyo"), URLs, emojis
- No date ranges — can't tell if it was their employer at commit time

**Used by:** OSS Insight, most lightweight analyzers

### Signal 3: OSS Insight Pre-Computed Org Data

The OSS Insight API returns organization affiliations of PR creators, pre-computed from GitHub profile data.

**Strengths:**
- Pre-aggregated, easy to consume
- Covers PR creators beyond just committers

**Weaknesses:**
- Same ~5.6% coverage as GitHub profiles (it's the same source)
- Returns headcount fractions, not contribution-weighted shares
- Percentages can sum to >100% (no "unaffiliated" category)

**Used by:** Our tool (as enrichment signal)

### Signal 4: Manual Curation (most accurate, doesn't scale)

Hand-curated files mapping developers to companies with date ranges. CNCF maintains [`developers_affiliations2.txt`](https://github.com/cncf/gitdm) in their gitdm repo. People submit PRs to update their own affiliation.

**Strengths:**
- Handles job changes (the only automated-free method that does)
- Human-verified accuracy

**Weaknesses:**
- Only works for specific ecosystems (CNCF, Linux Foundation, Apache)
- Requires constant human maintenance
- Doesn't scale to the long tail of OSS

**Used by:** CNCF (via gitdm), Linux Foundation, Apache Foundation

### Signal 5: GrimoireLab SortingHat (identity resolution engine)

A dedicated service that collects identities from multiple sources (git, GitHub, Jira, Slack), merges multiple identities of the same person, and stores time-ranged affiliations with manual correction via a UI.

**Strengths:**
- Most sophisticated approach
- Handles identity merging (same person, different emails)
- Time-ranged affiliations

**Weaknesses:**
- Requires running a service and manual curation
- Heavy operational overhead

**Used by:** Bitergia Analytics, GrimoireLab

## Industry-Standard Metric: Elephant Factor

The **Elephant Factor** (CHAOSS metric) measures the minimum number of companies whose employees contribute at least 50% of total commits.

**Calculation:**
1. Map each contributor to their organization
2. Sum commits per organization
3. Sort organizations by commit count descending
4. Count how many orgs it takes to reach 50% of total commits

**Interpretation:**
- EF=0: No corporate contributors (pure community/solo)
- EF=1: Single company dominates (risky — what if they pull out?)
- EF=2-3: Moderate diversity
- EF=4+: Healthy multi-org backing

The Elephant Factor is naturally resistant to noise from drive-by contributions. If Google has 5,000 commits and a random contributor from Grafana has 1, that single commit is 0.02% of the total and doesn't move the EF calculation at all.

CHAOSS defines an optional "Commit Count" filter ("Contributors with fewer than some minimum threshold of commits could be excluded") but most implementations don't apply it — the commit-weighting already marginalizes noise.

**Used by:** CHAOSS, GrimoireLab, Bitergia Analytics, CNCF (for project graduation requirements)

## Our Approach

We combine three automated signals (no manual curation, no LinkedIn):

| Signal | Source | Confidence | Coverage |
|---|---|---|---|
| Git commit email domain | `repos.listCommits` API | High | ~30-50% of commits |
| GitHub profile company/email/bio | `users.getByUsername` API | Medium | ~6% of users |
| OSS Insight org data | `ossinsight.io` API | Low | Same ~6% |

**Resolution priority** (per contributor):
1. Commit email corporate domain — strongest, set at commit time
2. GitHub profile `company` field — if filled and cleaned
3. GitHub profile `email` domain — if corporate
4. OSS Insight org — if available
5. Bio parsing — weakest signal
6. Default: "Independent"

**Scoring** uses commit-weighted Elephant Factor with corporate percentage as a depth multiplier.

### Why Commit-Weighted (Not Headcount-Weighted)

OSS Insight returns headcount fractions: "5.6% of PR creators are from Grafana." But if that's 1 person who opened 1 unmerged PR, it's not corporate backing — it's a drive-by.

Commit-weighting solves this naturally:
- 1 commit from Grafana on a 1,000-commit project = 0.1% weight (noise)
- 200 commits from Meta on the same project = 20% weight (real investment)

This is consistent with how CHAOSS Elephant Factor works and how CNCF evaluates organizational diversity for project graduation.
