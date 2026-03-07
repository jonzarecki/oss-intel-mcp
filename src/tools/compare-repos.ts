import type { CacheStore } from "../cache/store.js";
import type { GitHubClient } from "../github/client.js";
import { type AnalyzeRepoResult, handleAnalyzeRepo } from "./analyze-repo.js";

export interface CompareReposResult {
	repos: AnalyzeRepoResult[];
	comparison: {
		metric: string;
		values: { repo: string; value: number }[];
		winner: string;
	}[];
	recommendation: string;
}

export async function handleCompareRepos(
	repos: { owner: string; repo: string }[],
	github: GitHubClient,
	cache: CacheStore,
): Promise<CompareReposResult> {
	const results = await Promise.all(
		repos.map((r) => handleAnalyzeRepo(r.owner, r.repo, github, cache)),
	);

	const metricKeys: { key: string; label: string; extract: (r: AnalyzeRepoResult) => number }[] = [
		{ key: "verdict", label: "Overall Score", extract: (r) => r.verdict.score },
		{ key: "busFactor", label: "Bus Factor", extract: (r) => r.metrics.busFactor.score },
		{
			key: "activityTrend",
			label: "Activity Trend",
			extract: (r) => r.metrics.activityTrend.score,
		},
		{ key: "prHealth", label: "PR Health", extract: (r) => r.metrics.prHealth.score },
		{
			key: "issueHealth",
			label: "Issue Responsiveness",
			extract: (r) => r.metrics.issueHealth.score,
		},
		{
			key: "releaseCadence",
			label: "Release Cadence",
			extract: (r) => r.metrics.releaseCadence.score,
		},
		{ key: "affiliation", label: "Corporate Backing", extract: (r) => r.metrics.affiliation.score },
		{ key: "security", label: "Security", extract: (r) => r.metrics.security?.score ?? 0 },
	];

	const comparison = metricKeys.map(({ label, extract }) => {
		const values = results.map((r) => ({
			repo: r.repo.fullName,
			value: extract(r),
		}));
		const maxVal = Math.max(...values.map((v) => v.value));
		const winner = values.find((v) => v.value === maxVal)?.repo ?? "";
		return { metric: label, values, winner };
	});

	const overallScores = results.map((r) => ({
		repo: r.repo.fullName,
		score: r.verdict.score,
		verdict: r.verdict.verdict,
	}));
	const best = overallScores.sort((a, b) => b.score - a.score)[0];
	const recommendation = best
		? `${best.repo} scores highest overall (${best.score}/100, "${best.verdict}").`
		: "Unable to determine recommendation.";

	return { repos: results, comparison, recommendation };
}
