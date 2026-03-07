import { describe, expect, it } from "vitest";
import { computeBusFactor } from "../../src/metrics/bus-factor.js";
import type { ContributorData } from "../../src/metrics/types.js";

describe("computeBusFactor", () => {
	it("returns high risk and zero score for empty array", () => {
		const result = computeBusFactor([]);
		expect(result).toEqual({
			giniCoefficient: 1,
			topContributorShare: 0,
			top2Share: 0,
			isHighRisk: true,
			score: 0,
		});
	});

	it("returns high risk for single contributor", () => {
		const contributors: ContributorData[] = [{ login: "solo", contributions: 100 }];
		const result = computeBusFactor(contributors);
		expect(result.giniCoefficient).toBe(1);
		expect(result.topContributorShare).toBe(1);
		expect(result.top2Share).toBe(1);
		expect(result.isHighRisk).toBe(true);
		expect(result.score).toBeLessThan(10);
	});

	it("returns distributed metrics for two equal contributors", () => {
		const contributors: ContributorData[] = [
			{ login: "a", contributions: 50 },
			{ login: "b", contributions: 50 },
		];
		const result = computeBusFactor(contributors);
		expect(result.giniCoefficient).toBe(0);
		expect(result.topContributorShare).toBe(0.5);
		expect(result.top2Share).toBe(1);
		expect(result.isHighRisk).toBe(true); // top2 > 60%
		expect(result.score).toBeGreaterThan(0);
	});

	it("returns high risk when top 2 contributors exceed 60%", () => {
		const contributors: ContributorData[] = [
			{ login: "dominant", contributions: 70 },
			{ login: "sidekick", contributions: 20 },
			{ login: "minor", contributions: 10 },
		];
		const result = computeBusFactor(contributors);
		expect(result.topContributorShare).toBe(0.7);
		expect(result.top2Share).toBe(0.9);
		expect(result.isHighRisk).toBe(true);
	});

	it("returns not high risk when contribution is distributed among many", () => {
		const contributors: ContributorData[] = [
			{ login: "a", contributions: 15 },
			{ login: "b", contributions: 14 },
			{ login: "c", contributions: 13 },
			{ login: "d", contributions: 12 },
			{ login: "e", contributions: 11 },
			{ login: "f", contributions: 10 },
			{ login: "g", contributions: 9 },
			{ login: "h", contributions: 8 },
			{ login: "i", contributions: 5 },
			{ login: "j", contributions: 3 },
		];
		const result = computeBusFactor(contributors);
		expect(result.top2Share).toBeLessThanOrEqual(0.6);
		expect(result.isHighRisk).toBe(false);
		expect(result.score).toBeGreaterThan(0);
		expect(result.giniCoefficient).toBeLessThan(1);
	});

	it("returns zero score for contributors with zero total", () => {
		const contributors: ContributorData[] = [
			{ login: "a", contributions: 0 },
			{ login: "b", contributions: 0 },
		];
		const result = computeBusFactor(contributors);
		expect(result).toEqual({
			giniCoefficient: 1,
			topContributorShare: 0,
			top2Share: 0,
			isHighRisk: true,
			score: 0,
		});
	});
});
