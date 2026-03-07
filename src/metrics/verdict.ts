import type { AllMetrics, VerdictLabel, VerdictResult } from "./types.js";

interface WeightConfig {
	metric: string;
	key: keyof AllMetrics;
	weight: number;
}

const WEIGHTS: WeightConfig[] = [
	{ metric: "Activity Trend", key: "activityTrend", weight: 20 },
	{ metric: "Bus Factor", key: "busFactor", weight: 17 },
	{ metric: "PR Health", key: "prHealth", weight: 17 },
	{ metric: "Security", key: "security", weight: 17 },
	{ metric: "Issue Responsiveness", key: "issueHealth", weight: 13 },
	{ metric: "Release Cadence", key: "releaseCadence", weight: 8 },
	{ metric: "Corporate Backing", key: "affiliation", weight: 8 },
];

export function computeVerdict(metrics: AllMetrics): VerdictResult {
	const breakdown: VerdictResult["breakdown"] = [];
	let activeWeightSum = 0;
	let weightedScoreSum = 0;

	for (const w of WEIGHTS) {
		const metricValue = metrics[w.key];

		// Skip null metrics (e.g., security when scorecard unavailable)
		if (metricValue === null) continue;

		const score = metricValue.score;
		activeWeightSum += w.weight;

		breakdown.push({
			metric: w.metric,
			score,
			weight: w.weight,
			weightedScore: 0, // Filled after re-normalization
		});
	}

	// Re-normalize weights so they sum to 100
	for (const entry of breakdown) {
		const normalizedWeight = activeWeightSum > 0 ? (entry.weight / activeWeightSum) * 100 : 0;
		entry.weight = Math.round(normalizedWeight * 10) / 10;
		entry.weightedScore = Math.round(((entry.score * normalizedWeight) / 100) * 10) / 10;
		weightedScoreSum += entry.weightedScore;
	}

	const finalScore = Math.round(weightedScoreSum);
	const verdict = scoreToVerdict(finalScore);

	return {
		verdict,
		score: Math.max(0, Math.min(100, finalScore)),
		breakdown,
	};
}

function scoreToVerdict(score: number): VerdictLabel {
	if (score >= 70) return "Safe to adopt";
	if (score >= 40) return "Use with caution";
	return "Risky";
}
