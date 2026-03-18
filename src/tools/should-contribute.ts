import type { CacheStore } from "../cache/store.js";
import { getContributorOrgs } from "../external/oss-insight.js";
import type { GitHubClient } from "../github/client.js";
import { normalizeCompanyName, orgFromEmail } from "../metrics/affiliation.js";
import { computeIssueHealth } from "../metrics/issue-health.js";
import { computePRHealth } from "../metrics/pr-health.js";
import type { IssueData, PullRequestData } from "../metrics/types.js";

export interface ShouldContributeResult {
	repo: string;
	prHealth: ReturnType<typeof computePRHealth>;
	issueHealth: ReturnType<typeof computeIssueHealth>;
	goodFirstIssueCount: number;
	contributorRetention: {
		totalContributors: number;
		repeatContributors: number;
		retentionRate: number;
	};
	topMaintainers: {
		login: string;
		contributions: number;
		organization: string;
	}[];
	enrichmentSources: string[];
}

export async function handleShouldContribute(
	owner: string,
	repo: string,
	github: GitHubClient,
	cache: CacheStore,
): Promise<ShouldContributeResult> {
	const enrichmentSources: string[] = [];

	const [pulls, closedIssues, openIssues, contributors, commitEmailsRaw, ossInsightOrgs] =
		await Promise.all([
			github.getPulls(owner, repo, "closed", 100),
			github.getIssues(owner, repo, "closed", 100),
			github.getIssues(owner, repo, "open", 100),
			github.getContributors(owner, repo),
			github.getRecentCommitEmails(owner, repo),
			getContributorOrgs(owner, repo, cache),
		]);

	const commitEmailMap = new Map<string, string[]>();
	for (const ce of commitEmailsRaw) {
		if (!ce.login) continue;
		const existing = commitEmailMap.get(ce.login);
		if (existing) {
			existing.push(ce.email);
		} else {
			commitEmailMap.set(ce.login, [ce.email]);
		}
	}

	if (ossInsightOrgs) enrichmentSources.push("oss-insight");

	// PR health
	const prData: PullRequestData[] = pulls.map((p) => ({
		created_at: p.created_at,
		closed_at: p.closed_at,
		merged_at: p.merged_at,
	}));
	const prHealth = computePRHealth(prData);

	// Issue health with first response times
	const issueSubset = closedIssues.slice(0, 20);
	const issueData: IssueData[] = await Promise.all(
		issueSubset.map(async (issue) => {
			let firstResponseAt: string | null = null;
			if (issue.comments > 0) {
				try {
					const comments = await github.getIssueComments(owner, repo, issue.number);
					const nonAuthor = comments.find((c) => c.user?.login !== issue.user?.login);
					firstResponseAt = nonAuthor?.created_at ?? null;
				} catch {
					// Ignore
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
	const issueHealth = computeIssueHealth(issueData, openIssues.length);

	// Good first issues
	const goodFirstIssueCount = openIssues.filter((i) =>
		i.labels.some(
			(l) =>
				l.name.toLowerCase() === "good first issue" ||
				l.name.toLowerCase() === "good-first-issue" ||
				l.name.toLowerCase() === "beginner" ||
				l.name.toLowerCase() === "help wanted",
		),
	).length;

	// Contributor retention: count PR authors who appear more than once
	const prAuthorCounts = new Map<string, number>();
	for (const p of pulls) {
		const login = p.user?.login;
		if (login) {
			prAuthorCounts.set(login, (prAuthorCounts.get(login) ?? 0) + 1);
		}
	}
	const totalContributors = prAuthorCounts.size;
	const repeatContributors = Array.from(prAuthorCounts.values()).filter((c) => c > 1).length;

	// Top maintainers with org affiliation (uses computeAffiliation for consistency)
	const topMaintainerLogins = contributors.slice(0, 5);
	const rateInfo = github.getRateLimit();
	const canFetchOrgs = !rateInfo || rateInfo.remaining > 50;

	const [profiles, maintainerOrgResults] = await Promise.all([
		Promise.all(
			topMaintainerLogins.map((c) =>
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
					topMaintainerLogins.map((c) =>
						github.getUserOrgs(c.login).then(
							(orgs) => ({ login: c.login, orgs }),
							() => ({ login: c.login, orgs: [] as string[] }),
						),
					),
				)
			: Promise.resolve(
					topMaintainerLogins.map((c) => ({ login: c.login, orgs: [] as string[] })),
				),
	]);

	const maintainerOrgs = new Map(maintainerOrgResults.map((r) => [r.login, r.orgs]));

	const topMaintainers = topMaintainerLogins.map((c, i) => {
		const profile = profiles[i];
		let org = "Independent";
		const hint = { login: c.login, name: profile?.name ?? null };

		// Signal 1: repo-owner org membership
		const memberOrgs = maintainerOrgs.get(c.login) ?? [];
		if (memberOrgs.some((o) => o.toLowerCase() === owner.toLowerCase())) {
			org = normalizeCompanyName(owner);
		}

		// Signal 2: commit email
		if (org === "Independent") {
			const emails = commitEmailMap.get(c.login) ?? [];
			for (const email of emails) {
				const match = orgFromEmail(email, hint);
				if (match) {
					org = match;
					break;
				}
			}
		}

		// Signal 3: profile company
		if (org === "Independent" && profile?.company) {
			const cleaned = normalizeCompanyName(profile.company);
			if (cleaned && cleaned !== "Independent") org = cleaned;
		}

		// Signal 4: known corporate org membership
		if (org === "Independent") {
			for (const memberOrg of memberOrgs) {
				const cleaned = normalizeCompanyName(memberOrg);
				if (cleaned !== "Independent") {
					org = cleaned;
					break;
				}
			}
		}

		// Signal 5: profile email
		if (org === "Independent" && profile?.email) {
			const match = orgFromEmail(profile.email, hint);
			if (match) org = match;
		}

		return {
			login: c.login,
			contributions: c.contributions,
			organization: org,
		};
	});

	return {
		repo: `${owner}/${repo}`,
		prHealth,
		issueHealth,
		goodFirstIssueCount,
		contributorRetention: {
			totalContributors,
			repeatContributors,
			retentionRate: totalContributors > 0 ? repeatContributors / totalContributors : 0,
		},
		topMaintainers,
		enrichmentSources,
	};
}
