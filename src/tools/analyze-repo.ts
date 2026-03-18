import type { CacheStore } from "../cache/store.js";
import { getProjectInfo } from "../external/deps-dev.js";
import { getContributorOrgs } from "../external/oss-insight.js";
import { getScorecard } from "../external/scorecard.js";
import type { GitHubClient, RateLimitInfo } from "../github/client.js";
import { computeActivityTrend } from "../metrics/activity-trend.js";
import { computeAffiliation } from "../metrics/affiliation.js";
import { computeBusFactor } from "../metrics/bus-factor.js";
import { computeIssueHealth } from "../metrics/issue-health.js";
import { computePRHealth } from "../metrics/pr-health.js";
import { computeReleaseCadence } from "../metrics/release-cadence.js";
import { computeSecurity } from "../metrics/security.js";
import type { CommitActivityWeek } from "../github/types.js";
import type {
	IssueData,
	OrgContributionData,
	PullRequestData,
	ScorecardData,
} from "../metrics/types.js";
import { computeVerdict } from "../metrics/verdict.js";

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const THIRTEEN_WEEKS_MS = 13 * 7 * 24 * 60 * 60 * 1000;

export function needsActivityFallback(
	data: CommitActivityWeek[],
	pushedAt: string,
): "none" | "full" | "supplement" {
	const recentlyPushed = Date.now() - new Date(pushedAt).getTime() < SIX_MONTHS_MS;
	if (!recentlyPushed) return "none";
	if (data.length === 0) return "full";

	const sorted = [...data].sort((a, b) => a.week - b.week);
	const recent13 = sorted.slice(-13);
	const recentTotal = recent13.reduce((s, w) => s + w.total, 0);
	if (recentTotal === 0) return "supplement";

	return "none";
}

export interface AnalyzeRepoResult {
	repo: {
		fullName: string;
		description: string | null;
		language: string | null;
		license: string | null;
		stars: number;
		forks: number;
		openIssues: number;
		createdAt: string;
		archived: boolean;
	};
	verdict: ReturnType<typeof computeVerdict>;
	metrics: {
		busFactor: ReturnType<typeof computeBusFactor>;
		activityTrend: ReturnType<typeof computeActivityTrend>;
		prHealth: ReturnType<typeof computePRHealth>;
		issueHealth: ReturnType<typeof computeIssueHealth>;
		releaseCadence: ReturnType<typeof computeReleaseCadence>;
		affiliation: ReturnType<typeof computeAffiliation>;
		security: ReturnType<typeof computeSecurity>;
	};
	enrichmentSources: string[];
	rateLimit: RateLimitInfo | null;
}

export async function handleAnalyzeRepo(
	owner: string,
	repo: string,
	github: GitHubClient,
	cache: CacheStore,
): Promise<AnalyzeRepoResult> {
	const enrichmentSources: string[] = [];

	// Parallel fetch: GitHub core data + external enrichment
	const [
		repoData,
		contributors,
		commitActivity,
		pulls,
		issues,
		releases,
		commitEmailsRaw,
		depsDevData,
		ossInsightOrgs,
	] = await Promise.all([
		github.getRepo(owner, repo),
		github.getContributors(owner, repo),
		github.getCommitActivity(owner, repo),
		github.getPulls(owner, repo, "closed", 100),
		github.getIssues(owner, repo, "closed", 100),
		github.getReleases(owner, repo, 10),
		github.getRecentCommitEmails(owner, repo),
		getProjectInfo(owner, repo, cache),
		getContributorOrgs(owner, repo, cache),
	]);

	// Resolve scorecard data: prefer deps.dev embedded, fall back to direct API
	let scorecardData: ScorecardData | null = null;
	if (depsDevData?.scorecard) {
		scorecardData = depsDevData.scorecard;
		enrichmentSources.push("deps.dev");
	} else {
		const directScorecard = await getScorecard(owner, repo, cache);
		if (directScorecard) {
			scorecardData = directScorecard;
			enrichmentSources.push("openssf-scorecard");
		}
	}

	if (ossInsightOrgs) {
		enrichmentSources.push("oss-insight");
	}

	// Fetch user profiles and org memberships for affiliation
	const topContributors = contributors.slice(0, 20);
	const rateInfo = github.getRateLimit();
	const canFetchOrgs = !rateInfo || rateInfo.remaining > 50;

	const [userProfiles, userOrgResults] = await Promise.all([
		Promise.all(
			topContributors.map((c) =>
				github.getUserProfile(c.login).catch(() => ({
					login: c.login,
					name: null,
					company: null,
					email: null,
					bio: null,
					blog: null,
					avatar_url: "",
				})),
			),
		),
		canFetchOrgs
			? Promise.all(
					topContributors.map((c) =>
						github.getUserOrgs(c.login).then(
							(orgs) => ({ login: c.login, orgs }),
							() => ({ login: c.login, orgs: [] as string[] }),
						),
					),
				)
			: Promise.resolve(topContributors.map((c) => ({ login: c.login, orgs: [] as string[] }))),
	]);

	const userOrgs = new Map(userOrgResults.map((r) => [r.login, r.orgs]));
	const userNames = new Map(userProfiles.map((u) => [u.login, u.name ?? null]));

	const contributorCommits = new Map(contributors.map((c) => [c.login, c.contributions]));

	// Build login → [email1, email2, ...] map from commit metadata
	const commitEmails = new Map<string, string[]>();
	for (const ce of commitEmailsRaw) {
		if (!ce.login) continue;
		const existing = commitEmails.get(ce.login);
		if (existing) {
			existing.push(ce.email);
		} else {
			commitEmails.set(ce.login, [ce.email]);
		}
	}

	// Compute all metrics
	const busFactor = computeBusFactor(
		contributors.map((c) => ({ login: c.login, contributions: c.contributions })),
	);

	let activityData: CommitActivityWeek[] = commitActivity;
	const fallbackMode = needsActivityFallback(commitActivity, repoData.pushed_at);

	if (fallbackMode === "full") {
		const fallbackData = await github.getCommitCountsFallback(owner, repo);
		if (fallbackData.length > 0) {
			activityData = fallbackData;
			enrichmentSources.push("github-commits-fallback");
		}
	} else if (fallbackMode === "supplement") {
		const thirteenWeeksAgo = new Date(Date.now() - THIRTEEN_WEEKS_MS);
		const recentData = await github.getCommitCountsFallback(owner, repo, thirteenWeeksAgo);
		if (recentData.length > 0) {
			const cutoff = Math.floor(thirteenWeeksAgo.getTime() / 1000);
			const olderWeeks = commitActivity.filter((w) => w.week < cutoff);
			activityData = [...olderWeeks, ...recentData];
			enrichmentSources.push("github-commits-fallback");
		}
	}

	const activityTrend = computeActivityTrend(
		activityData.map((w) => ({ week: w.week, total: w.total })),
	);

	const prData: PullRequestData[] = pulls.map((p) => ({
		created_at: p.created_at,
		closed_at: p.closed_at,
		merged_at: p.merged_at,
	}));
	const prHealth = computePRHealth(prData);

	// For issue health, we need first response times.
	// Fetch first comment for each issue (limited to first 20 for API budget)
	const issueSubset = issues.slice(0, 20);
	const issueData: IssueData[] = await Promise.all(
		issueSubset.map(async (issue) => {
			let firstResponseAt: string | null = null;
			if (issue.comments > 0) {
				try {
					const comments = await github.getIssueComments(owner, repo, issue.number);
					const nonAuthor = comments.find((c) => c.user?.login !== issue.user?.login);
					firstResponseAt = nonAuthor?.created_at ?? null;
				} catch {
					// Ignore comment fetch failures
				}
			}
			return {
				number: issue.number,
				created_at: issue.created_at,
				closed_at: issue.closed_at,
				author_login: issue.user?.login ?? null,
				first_response_at: firstResponseAt,
			};
		}),
	);
	const issueHealth = computeIssueHealth(issueData, repoData.open_issues_count);

	const releaseCadence = computeReleaseCadence(
		releases.map((r) => ({
			published_at: r.published_at,
			created_at: r.created_at,
			prerelease: r.prerelease,
			draft: r.draft,
		})),
	);

	const ossInsightOrgData: OrgContributionData[] | null = ossInsightOrgs
		? ossInsightOrgs.rows.map((r) => ({
				org_name: r.org_name,
				contributor_count: Number.parseInt(r.pull_request_creators, 10),
				percentage: Number.parseFloat(r.percentage),
			}))
		: null;

	const affiliation = computeAffiliation({
		userProfiles: userProfiles.map((u) => ({
			login: u.login,
			company: u.company,
			email: u.email,
			bio: u.bio,
		})),
		ossInsightOrgs: ossInsightOrgData,
		contributorCommits,
		commitEmails,
		userOrgs,
		repoOwner: owner,
		userNames,
	});

	const security = computeSecurity(scorecardData);

	const verdict = computeVerdict({
		busFactor,
		activityTrend,
		prHealth,
		issueHealth,
		releaseCadence,
		affiliation,
		security,
	});

	return {
		repo: {
			fullName: repoData.full_name,
			description: repoData.description,
			language: repoData.language,
			license: repoData.license?.spdx_id ?? null,
			stars: repoData.stargazers_count,
			forks: repoData.forks_count,
			openIssues: repoData.open_issues_count,
			createdAt: repoData.created_at,
			archived: repoData.archived,
		},
		verdict,
		metrics: {
			busFactor,
			activityTrend,
			prHealth,
			issueHealth,
			releaseCadence,
			affiliation,
			security,
		},
		enrichmentSources,
		rateLimit: github.getRateLimit(),
	};
}
