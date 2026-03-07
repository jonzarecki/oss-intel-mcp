import type { HealthLabel, IssueData, IssueHealthResult } from "./types.js";

export function computeIssueHealth(issues: IssueData[], openIssueCount = 0): IssueHealthResult {
	if (issues.length === 0 && openIssueCount === 0) {
		return { medianResponseTimeHours: null, closeRate: 0, label: "concerning", score: 0 };
	}

	const closed = issues.filter((i) => i.closed_at);
	const totalKnown = issues.length + openIssueCount;
	const closeRate = totalKnown > 0 ? closed.length / totalKnown : 0;

	const responseTimesHours = issues
		.filter((i) => i.first_response_at)
		.map((i) => {
			const created = new Date(i.created_at).getTime();
			const responded = new Date(i.first_response_at!).getTime();
			return (responded - created) / (1000 * 60 * 60);
		})
		.filter((h) => h >= 0)
		.sort((a, b) => a - b);

	const medianResponseTimeHours = responseTimesHours.length > 0 ? median(responseTimesHours) : null;

	const label = classifyHealth(closeRate, medianResponseTimeHours, openIssueCount);

	// Score: close rate (40%), response speed (40%), backlog penalty (20%)
	const closeRateScore = closeRate * 40;
	const responseScore =
		medianResponseTimeHours !== null
			? Math.max(0, 40 - (medianResponseTimeHours / 168) * 40) // 168h = 1 week
			: 10; // Partial credit if no data
	const backlogPenalty = Math.min(openIssueCount / 50, 1) * 20;

	const score = Math.round(closeRateScore + responseScore - backlogPenalty);

	return {
		medianResponseTimeHours:
			medianResponseTimeHours !== null ? Math.round(medianResponseTimeHours * 10) / 10 : null,
		closeRate: Math.round(closeRate * 1000) / 1000,
		label,
		score: Math.max(0, Math.min(100, score)),
	};
}

function classifyHealth(
	closeRate: number,
	medianHours: number | null,
	openCount: number,
): HealthLabel {
	if (openCount > 50) return "concerning";
	if (closeRate >= 0.7 && (medianHours === null || medianHours < 48)) {
		return "healthy";
	}
	if (closeRate >= 0.4) {
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
