import { describe, expect, it } from "vitest";
import { computeIssueHealth } from "../../src/metrics/issue-health.js";
import type { IssueData } from "../../src/metrics/types.js";

function issue(
	number: number,
	created: string,
	closed: string | null,
	firstResponse: string | null,
): IssueData {
	return {
		number,
		created_at: created,
		closed_at: closed,
		author_login: "user",
		first_response_at: firstResponse,
	};
}

describe("computeIssueHealth", () => {
	it("returns concerning for empty array", () => {
		const result = computeIssueHealth([]);
		expect(result).toEqual({
			medianResponseTimeHours: null,
			closeRate: 0,
			label: "concerning",
			score: 0,
		});
	});

	it("returns healthy when all closed with fast response", () => {
		const issues: IssueData[] = [
			issue(1, "2024-01-01T10:00:00Z", "2024-01-01T12:00:00Z", "2024-01-01T10:30:00Z"),
			issue(2, "2024-01-02T10:00:00Z", "2024-01-02T11:00:00Z", "2024-01-02T10:30:00Z"),
		];
		const result = computeIssueHealth(issues);
		expect(result.closeRate).toBe(1);
		expect(result.medianResponseTimeHours).toBeLessThan(48);
		expect(result.label).toBe("healthy");
		expect(result.score).toBeGreaterThan(70);
	});

	it("returns concerning when none closed", () => {
		const issues: IssueData[] = [
			issue(1, "2024-01-01T10:00:00Z", null, null),
			issue(2, "2024-01-02T10:00:00Z", null, null),
		];
		const result = computeIssueHealth(issues);
		expect(result.closeRate).toBe(0);
		expect(result.label).toBe("concerning");
	});

	it("returns mixed metrics for mixed issue outcomes", () => {
		const issues: IssueData[] = [
			issue(1, "2024-01-01T10:00:00Z", "2024-01-01T11:00:00Z", "2024-01-01T10:30:00Z"),
			issue(2, "2024-01-02T10:00:00Z", null, null),
			issue(3, "2024-01-03T10:00:00Z", "2024-01-03T14:00:00Z", "2024-01-03T10:30:00Z"),
		];
		const result = computeIssueHealth(issues);
		expect(result.closeRate).toBeCloseTo(2 / 3, 2);
		expect(result.medianResponseTimeHours).not.toBeNull();
	});
});
