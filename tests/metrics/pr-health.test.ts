import { describe, expect, it } from "vitest";
import { computePRHealth } from "../../src/metrics/pr-health.js";
import type { PullRequestData } from "../../src/metrics/types.js";

function pr(
	created: string,
	closed: string | null,
	merged: string | null,
	firstReview?: string | null,
): PullRequestData {
	return {
		created_at: created,
		closed_at: closed,
		merged_at: merged,
		first_review_at: firstReview,
	};
}

describe("computePRHealth", () => {
	it("returns concerning for empty array", () => {
		const result = computePRHealth([]);
		expect(result).toEqual({
			mergeRate: 0,
			medianTimeToMergeHours: null,
			medianTimeToFirstReviewHours: null,
			label: "concerning",
			score: 0,
		});
	});

	it("returns healthy when all PRs merged quickly with fast reviews", () => {
		const pulls: PullRequestData[] = [
			pr(
				"2024-01-01T10:00:00Z",
				"2024-01-01T11:00:00Z",
				"2024-01-01T11:00:00Z",
				"2024-01-01T10:30:00Z",
			),
			pr(
				"2024-01-02T10:00:00Z",
				"2024-01-02T12:00:00Z",
				"2024-01-02T12:00:00Z",
				"2024-01-02T10:30:00Z",
			),
		];
		const result = computePRHealth(pulls);
		expect(result.mergeRate).toBe(1);
		expect(result.medianTimeToMergeHours).toBeLessThan(24);
		expect(result.label).toBe("healthy");
		expect(result.score).toBeGreaterThan(70);
	});

	it("returns concerning when none merged", () => {
		const pulls: PullRequestData[] = [
			pr("2024-01-01T10:00:00Z", "2024-01-05T10:00:00Z", null, null),
			pr("2024-01-02T10:00:00Z", "2024-01-06T10:00:00Z", null, null),
		];
		const result = computePRHealth(pulls);
		expect(result.mergeRate).toBe(0);
		expect(result.medianTimeToMergeHours).toBe(null);
	});

	it("returns mixed metrics for mixed PR outcomes", () => {
		const pulls: PullRequestData[] = [
			pr(
				"2024-01-01T10:00:00Z",
				"2024-01-01T11:00:00Z",
				"2024-01-01T11:00:00Z",
				"2024-01-01T10:30:00Z",
			),
			pr("2024-01-02T10:00:00Z", "2024-01-02T10:00:00Z", null, null),
			pr("2024-01-03T10:00:00Z", "2024-01-03T14:00:00Z", "2024-01-03T14:00:00Z", null),
		];
		const result = computePRHealth(pulls);
		expect(result.mergeRate).toBeCloseTo(2 / 3, 2);
		expect(result.medianTimeToMergeHours).not.toBeNull();
	});
});
