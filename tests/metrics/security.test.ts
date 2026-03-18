import { describe, expect, it } from "vitest";
import { computeSecurity } from "../../src/metrics/security.js";
import type { ScorecardData } from "../../src/metrics/types.js";

function check(name: string, score: number, reason: string): ScorecardData["checks"][number] {
	return {
		name,
		score,
		reason,
		documentation: { url: "https://example.com" },
	};
}

describe("computeSecurity", () => {
	it("returns null for null input", () => {
		expect(computeSecurity(null)).toBe(null);
	});

	it("returns high score when all relevant checks are perfect", () => {
		const scorecard: ScorecardData = {
			overallScore: 10,
			checks: [
				check("Vulnerabilities", 10, "No known vulnerabilities"),
				check("CI-Tests", 10, "Tests pass"),
				check("Code-Review", 10, "Code reviewed"),
				check("Security-Policy", 10, "Policy present"),
				check("SAST", 10, "SAST enabled"),
				check("Dependency-Update-Tool", 10, "Dependabot"),
				check("Maintained", 10, "Maintained"),
				check("Token-Permissions", 10, "Least privilege"),
				check("Dangerous-Workflow", 10, "Safe workflows"),
			],
		};
		const result = computeSecurity(scorecard);
		expect(result).not.toBe(null);
		expect(result!.score).toBe(100);
		expect(result!.overallScore).toBe(100);
	});

	it("returns mixed score for mixed check results", () => {
		const scorecard: ScorecardData = {
			overallScore: 5,
			checks: [
				check("Vulnerabilities", 10, "OK"),
				check("CI-Tests", 5, "Partial"),
				check("Code-Review", 0, "Missing"),
				check("Security-Policy", 10, "OK"),
			],
		};
		const result = computeSecurity(scorecard);
		expect(result).not.toBe(null);
		expect(result!.score).toBeGreaterThan(0);
		expect(result!.score).toBeLessThan(100);
	});

	it("skips checks with score -1 (N/A)", () => {
		const scorecard: ScorecardData = {
			overallScore: 5,
			checks: [
				check("Vulnerabilities", 10, "OK"),
				check("CI-Tests", -1, "Skipped"),
				check("Code-Review", -1, "N/A"),
			],
		};
		const result = computeSecurity(scorecard);
		expect(result).not.toBe(null);
		expect(result!.subScores.every((s) => s.score >= 0)).toBe(true);
	});

	it("adjusts Code-Review score down when no reviewers are assigned (rubber-stamp)", () => {
		const scorecard: ScorecardData = {
			overallScore: 8,
			checks: [
				check("Code-Review", 10, "all changesets reviewed"),
				check("Vulnerabilities", 10, "OK"),
			],
		};
		const prData = Array.from({ length: 20 }, () => ({ requestedReviewerCount: 0 }));
		const result = computeSecurity(scorecard, prData);
		expect(result).not.toBe(null);
		expect(result!.reviewDepth).not.toBe(null);
		expect(result!.reviewDepth!.label).toBe("rubber-stamp");
		expect(result!.reviewDepth!.reviewerAssignmentRate).toBe(0);
		const codeReview = result!.subScores.find((s) => s.name === "Code Review");
		expect(codeReview).toBeDefined();
		expect(codeReview!.score).toBeLessThanOrEqual(3);
	});

	it("keeps Code-Review score when reviewers are consistently assigned (thorough)", () => {
		const scorecard: ScorecardData = {
			overallScore: 9,
			checks: [
				check("Code-Review", 10, "all changesets reviewed"),
				check("Vulnerabilities", 10, "OK"),
			],
		};
		const prData = Array.from({ length: 20 }, () => ({ requestedReviewerCount: 2 }));
		const result = computeSecurity(scorecard, prData);
		expect(result).not.toBe(null);
		expect(result!.reviewDepth!.label).toBe("thorough");
		const codeReview = result!.subScores.find((s) => s.name === "Code Review");
		expect(codeReview!.score).toBe(10);
	});

	it("caps Code-Review score at 6 for partial review coverage", () => {
		const scorecard: ScorecardData = {
			overallScore: 8,
			checks: [check("Code-Review", 10, "reviewed")],
		};
		const prData = [
			...Array.from({ length: 10 }, () => ({ requestedReviewerCount: 1 })),
			...Array.from({ length: 10 }, () => ({ requestedReviewerCount: 0 })),
		];
		const result = computeSecurity(scorecard, prData);
		expect(result!.reviewDepth!.label).toBe("partial");
		const codeReview = result!.subScores.find((s) => s.name === "Code Review");
		expect(codeReview!.score).toBeLessThanOrEqual(6);
	});

	it("returns null reviewDepth when no PR data provided", () => {
		const scorecard: ScorecardData = {
			overallScore: 8,
			checks: [check("Code-Review", 10, "reviewed")],
		};
		const result = computeSecurity(scorecard);
		expect(result!.reviewDepth).toBe(null);
		const codeReview = result!.subScores.find((s) => s.name === "Code Review");
		expect(codeReview!.score).toBe(10);
	});
});
