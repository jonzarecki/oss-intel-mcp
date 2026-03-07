import type { HealthLabel, PRHealthResult, PullRequestData } from "./types.js";

export function computePRHealth(pulls: PullRequestData[]): PRHealthResult {
	if (pulls.length === 0) {
		return {
			mergeRate: 0,
			medianTimeToMergeHours: null,
			medianTimeToFirstReviewHours: null,
			label: "concerning",
			score: 0,
		};
	}

	const closed = pulls.filter((p) => p.closed_at);
	const merged = pulls.filter((p) => p.merged_at);
	const mergeRate = closed.length > 0 ? merged.length / closed.length : 0;

	const mergeTimesHours = merged
		.map((p) => {
			const created = new Date(p.created_at).getTime();
			const mergedAt = new Date(p.merged_at!).getTime();
			return (mergedAt - created) / (1000 * 60 * 60);
		})
		.filter((h) => h >= 0)
		.sort((a, b) => a - b);

	const medianTimeToMergeHours = mergeTimesHours.length > 0 ? median(mergeTimesHours) : null;

	const reviewTimesHours = pulls
		.filter((p) => p.first_review_at)
		.map((p) => {
			const created = new Date(p.created_at).getTime();
			const reviewed = new Date(p.first_review_at!).getTime();
			return (reviewed - created) / (1000 * 60 * 60);
		})
		.filter((h) => h >= 0)
		.sort((a, b) => a - b);

	const medianTimeToFirstReviewHours =
		reviewTimesHours.length > 0 ? median(reviewTimesHours) : null;

	const label = classifyHealth(mergeRate, medianTimeToMergeHours);

	// Score: merge rate (40%), merge speed (30%), review speed (30%)
	const mergeRateScore = mergeRate * 40;
	const mergeSpeedScore =
		medianTimeToMergeHours !== null
			? Math.max(0, 30 - (medianTimeToMergeHours / 168) * 30) // 168h = 1 week
			: 0;
	const reviewSpeedScore =
		medianTimeToFirstReviewHours !== null
			? Math.max(0, 30 - (medianTimeToFirstReviewHours / 72) * 30) // 72h = 3 days
			: 0;

	const score = Math.round(mergeRateScore + mergeSpeedScore + reviewSpeedScore);

	return {
		mergeRate: Math.round(mergeRate * 1000) / 1000,
		medianTimeToMergeHours:
			medianTimeToMergeHours !== null ? Math.round(medianTimeToMergeHours * 10) / 10 : null,
		medianTimeToFirstReviewHours:
			medianTimeToFirstReviewHours !== null
				? Math.round(medianTimeToFirstReviewHours * 10) / 10
				: null,
		label,
		score: Math.max(0, Math.min(100, score)),
	};
}

function classifyHealth(mergeRate: number, medianMergeHours: number | null): HealthLabel {
	if (mergeRate >= 0.7 && (medianMergeHours === null || medianMergeHours < 168)) {
		return "healthy";
	}
	if (mergeRate >= 0.4) {
		return "moderate";
	}
	return "concerning";
}

function median(sorted: number[]): number {
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
	}
	return sorted[mid] ?? 0;
}
