import { describe, expect, it } from "vitest";
import { computeActivityTrend } from "../../src/metrics/activity-trend.js";
import type { WeeklyActivity } from "../../src/metrics/types.js";

describe("computeActivityTrend", () => {
	it("returns declining for empty array", () => {
		const result = computeActivityTrend([]);
		expect(result).toEqual({
			trend: "declining",
			percentageChange: -1,
			recentCommits: 0,
			previousCommits: 0,
			score: 0,
		});
	});

	it("returns growing when recent activity exceeds previous by >15%", () => {
		// 13 weeks recent, 13 weeks previous
		const activity: WeeklyActivity[] = [];
		for (let w = 1; w <= 26; w++) {
			activity.push({
				week: w,
				total: w <= 13 ? 2 : 4, // previous: 26, recent: 52 -> 100% increase
			});
		}
		const result = computeActivityTrend(activity);
		expect(result.trend).toBe("growing");
		expect(result.percentageChange).toBeGreaterThan(0.15);
		expect(result.recentCommits).toBe(52);
		expect(result.previousCommits).toBe(26);
		expect(result.score).toBeGreaterThan(0);
	});

	it("returns stable when change is between -15% and 15%", () => {
		const activity: WeeklyActivity[] = [];
		for (let w = 1; w <= 26; w++) {
			activity.push({ week: w, total: 5 });
		}
		const result = computeActivityTrend(activity);
		expect(result.trend).toBe("stable");
		expect(result.percentageChange).toBe(0);
	});

	it("returns declining when change is < -15%", () => {
		const activity: WeeklyActivity[] = [];
		for (let w = 1; w <= 26; w++) {
			activity.push({
				week: w,
				total: w <= 13 ? 10 : 2,
			});
		}
		const result = computeActivityTrend(activity);
		expect(result.trend).toBe("declining");
		expect(result.percentageChange).toBeLessThan(-0.15);
	});

	it("handles no previous activity (previousCommits = 0)", () => {
		// Only recent weeks, no previous period
		const activity: WeeklyActivity[] = [];
		for (let w = 1; w <= 13; w++) {
			activity.push({ week: w, total: 5 });
		}
		const result = computeActivityTrend(activity);
		expect(result.previousCommits).toBe(0);
		expect(result.recentCommits).toBe(65);
		expect(result.percentageChange).toBe(100); // recent > 0, previous = 0
	});

	it("returns zero score when recent commits are zero", () => {
		const activity: WeeklyActivity[] = [];
		for (let w = 1; w <= 26; w++) {
			activity.push({
				week: w,
				total: w <= 13 ? 10 : 0,
			});
		}
		const result = computeActivityTrend(activity);
		expect(result.recentCommits).toBe(0);
		expect(result.score).toBe(0);
	});
});
