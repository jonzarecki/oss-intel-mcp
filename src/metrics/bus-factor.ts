import type { BusFactorResult, ContributorData } from "./types.js";

export function computeBusFactor(contributors: ContributorData[]): BusFactorResult {
	if (contributors.length === 0) {
		return { giniCoefficient: 1, topContributorShare: 0, top2Share: 0, isHighRisk: true, score: 0 };
	}

	const totalCommits = contributors.reduce((sum, c) => sum + c.contributions, 0);
	if (totalCommits === 0) {
		return { giniCoefficient: 1, topContributorShare: 0, top2Share: 0, isHighRisk: true, score: 0 };
	}

	const sorted = [...contributors].sort((a, b) => b.contributions - a.contributions);
	const topShare = (sorted[0]?.contributions ?? 0) / totalCommits;
	const top2Contributions = (sorted[0]?.contributions ?? 0) + (sorted[1]?.contributions ?? 0);
	const top2Share = top2Contributions / totalCommits;
	const isHighRisk = top2Share > 0.6;

	const gini = computeGini(sorted.map((c) => c.contributions));

	// Score: 0 (single contributor, gini=1) to 100 (perfectly distributed, gini=0)
	// Also penalize when contributor count is very low
	const distributionScore = (1 - gini) * 100;
	const countBonus = Math.min(sorted.length / 10, 1);
	const score = Math.round(distributionScore * 0.7 + countBonus * 30);

	return {
		giniCoefficient: Math.round(gini * 1000) / 1000,
		topContributorShare: Math.round(topShare * 1000) / 1000,
		top2Share: Math.round(top2Share * 1000) / 1000,
		isHighRisk,
		score: Math.max(0, Math.min(100, score)),
	};
}

function computeGini(values: number[]): number {
	const n = values.length;
	if (n <= 1) return 1;

	const sorted = [...values].sort((a, b) => a - b);
	const mean = sorted.reduce((s, v) => s + v, 0) / n;
	if (mean === 0) return 1;

	let sumDiffs = 0;
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			sumDiffs += Math.abs((sorted[i] ?? 0) - (sorted[j] ?? 0));
		}
	}

	return sumDiffs / (2 * n * n * mean);
}
