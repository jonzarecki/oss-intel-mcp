import type { ActivityTrendResult, TrendLabel, WeeklyActivity } from "./types.js";

const WEEKS_IN_3_MONTHS = 13;
const GROWING_THRESHOLD = 0.15;
const DECLINING_THRESHOLD = -0.15;

export function computeActivityTrend(commitActivity: WeeklyActivity[]): ActivityTrendResult {
	if (commitActivity.length === 0) {
		return {
			trend: "declining",
			percentageChange: -1,
			recentCommits: 0,
			previousCommits: 0,
			score: 0,
		};
	}

	const sorted = [...commitActivity].sort((a, b) => a.week - b.week);

	const recentWeeks = sorted.slice(-WEEKS_IN_3_MONTHS);
	const previousWeeks = sorted.slice(
		Math.max(0, sorted.length - WEEKS_IN_3_MONTHS * 2),
		Math.max(0, sorted.length - WEEKS_IN_3_MONTHS),
	);

	const recentCommits = recentWeeks.reduce((sum, w) => sum + w.total, 0);
	const previousCommits = previousWeeks.reduce((sum, w) => sum + w.total, 0);

	let percentageChange: number;
	if (previousCommits === 0) {
		percentageChange = recentCommits > 0 ? 100 : 0;
	} else {
		percentageChange = (recentCommits - previousCommits) / previousCommits;
	}

	let trend: TrendLabel;
	if (recentCommits === 0 && previousCommits === 0) {
		trend = "declining";
	} else if (percentageChange > GROWING_THRESHOLD) {
		trend = "growing";
	} else if (percentageChange < DECLINING_THRESHOLD) {
		trend = "declining";
	} else {
		trend = "stable";
	}

	// Score: 0 (dead project) to 100 (very active and growing)
	let score: number;
	if (recentCommits === 0) {
		score = 0;
	} else {
		const activityBase = Math.min(recentCommits / 50, 1) * 60;
		const trendBonus = trend === "growing" ? 40 : trend === "stable" ? 25 : 10;
		score = Math.round(activityBase + trendBonus);
	}

	return {
		trend,
		percentageChange: Math.round(percentageChange * 100) / 100,
		recentCommits,
		previousCommits,
		score: Math.max(0, Math.min(100, score)),
	};
}
