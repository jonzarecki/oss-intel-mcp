import { describe, expect, it } from "vitest";
import type { AllMetrics } from "../../src/metrics/types.js";
import { computeVerdict } from "../../src/metrics/verdict.js";

function allHigh(): AllMetrics {
	return {
		busFactor: {
			giniCoefficient: 0.2,
			topContributorShare: 0.3,
			top2Share: 0.5,
			isHighRisk: false,
			score: 85,
		},
		activityTrend: {
			trend: "growing",
			percentageChange: 0.2,
			recentCommits: 100,
			previousCommits: 80,
			score: 90,
		},
		prHealth: {
			mergeRate: 0.9,
			medianTimeToMergeHours: 24,
			medianTimeToFirstReviewHours: 12,
			label: "healthy",
			score: 88,
		},
		issueHealth: { medianResponseTimeHours: 24, closeRate: 0.85, label: "healthy", score: 90 },
		releaseCadence: { averageIntervalDays: 30, regularityScore: 80, label: "regular", score: 85 },
		affiliation: {
			topContributors: [],
			orgShares: [],
			corporatePercentage: 0.7,
			score: 80,
		},
		security: { overallScore: 95, subScores: [], score: 95 },
	};
}

function allLow(): AllMetrics {
	return {
		busFactor: {
			giniCoefficient: 0.9,
			topContributorShare: 0.8,
			top2Share: 0.95,
			isHighRisk: true,
			score: 15,
		},
		activityTrend: {
			trend: "declining",
			percentageChange: -0.5,
			recentCommits: 5,
			previousCommits: 50,
			score: 10,
		},
		prHealth: {
			mergeRate: 0.1,
			medianTimeToMergeHours: 500,
			medianTimeToFirstReviewHours: 200,
			label: "concerning",
			score: 5,
		},
		issueHealth: { medianResponseTimeHours: 200, closeRate: 0.2, label: "concerning", score: 10 },
		releaseCadence: { averageIntervalDays: 400, regularityScore: 10, label: "stalled", score: 5 },
		affiliation: {
			topContributors: [],
			orgShares: [],
			corporatePercentage: 0.1,
			score: 15,
		},
		security: { overallScore: 20, subScores: [], score: 20 },
	};
}

function mixed(): AllMetrics {
	return {
		busFactor: {
			giniCoefficient: 0.5,
			topContributorShare: 0.4,
			top2Share: 0.55,
			isHighRisk: false,
			score: 55,
		},
		activityTrend: {
			trend: "stable",
			percentageChange: 0,
			recentCommits: 30,
			previousCommits: 30,
			score: 50,
		},
		prHealth: {
			mergeRate: 0.5,
			medianTimeToMergeHours: 100,
			medianTimeToFirstReviewHours: 50,
			label: "moderate",
			score: 50,
		},
		issueHealth: { medianResponseTimeHours: 72, closeRate: 0.5, label: "moderate", score: 50 },
		releaseCadence: { averageIntervalDays: 60, regularityScore: 50, label: "irregular", score: 50 },
		affiliation: {
			topContributors: [],
			orgShares: [],
			corporatePercentage: 0.4,
			score: 50,
		},
		security: { overallScore: 50, subScores: [], score: 50 },
	};
}

describe("computeVerdict", () => {
	it("returns Safe to adopt when all scores are high", () => {
		const result = computeVerdict(allHigh());
		expect(result.verdict).toBe("Safe to adopt");
		expect(result.score).toBeGreaterThanOrEqual(70);
		expect(result.breakdown.length).toBeGreaterThan(0);
	});

	it("returns Risky when all scores are low", () => {
		const result = computeVerdict(allLow());
		expect(result.verdict).toBe("Risky");
		expect(result.score).toBeLessThan(40);
	});

	it("returns Use with caution for mixed scores", () => {
		const result = computeVerdict(mixed());
		expect(result.verdict).toBe("Use with caution");
		expect(result.score).toBeGreaterThanOrEqual(40);
		expect(result.score).toBeLessThan(70);
	});

	it("re-normalizes weights when security is null", () => {
		const metrics: AllMetrics = {
			...allHigh(),
			security: null,
		};
		const result = computeVerdict(metrics);
		expect(result.verdict).toBe("Safe to adopt");
		expect(result.breakdown.find((b) => b.metric === "Security")).toBeUndefined();
		const totalWeight = result.breakdown.reduce((s, b) => s + b.weight, 0);
		expect(Math.round(totalWeight)).toBe(100);
	});
});
