import { describe, expect, it } from "vitest";
import { computeReleaseCadence } from "../../src/metrics/release-cadence.js";
import type { ReleaseData } from "../../src/metrics/types.js";

function release(published: string | null, prerelease: boolean, draft: boolean): ReleaseData {
	return {
		published_at: published,
		created_at: published ?? "2024-01-01T00:00:00Z",
		prerelease,
		draft,
	};
}

function addDays(iso: string, days: number): string {
	const d = new Date(iso);
	d.setDate(d.getDate() + days);
	return d.toISOString();
}

describe("computeReleaseCadence", () => {
	it("returns stalled with zero score for empty array", () => {
		const result = computeReleaseCadence([]);
		expect(result).toEqual({
			averageIntervalDays: null,
			regularityScore: 0,
			label: "stalled",
			score: 0,
		});
	});

	it("returns partial score for single stable release", () => {
		const releases: ReleaseData[] = [release("2024-01-01T00:00:00Z", false, false)];
		const result = computeReleaseCadence(releases);
		expect(result.averageIntervalDays).toBe(null);
		expect(result.regularityScore).toBe(0);
		expect(result.label).toBe("stalled");
		expect(result.score).toBe(20);
	});

	it("returns regular label for regular monthly releases", () => {
		const releases: ReleaseData[] = [];
		let date = "2024-01-01T00:00:00Z";
		for (let i = 0; i < 12; i++) {
			releases.push(release(date, false, false));
			date = addDays(date, 30);
		}
		const result = computeReleaseCadence(releases);
		expect(result.averageIntervalDays).toBeCloseTo(30, 0);
		expect(result.regularityScore).toBeGreaterThanOrEqual(40);
		expect(result.label).toBe("regular");
	});

	it("returns irregular for inconsistent intervals", () => {
		const releases: ReleaseData[] = [
			release("2024-01-01T00:00:00Z", false, false),
			release("2024-01-15T00:00:00Z", false, false),
			release("2024-06-01T00:00:00Z", false, false),
			release("2024-06-05T00:00:00Z", false, false),
		];
		const result = computeReleaseCadence(releases);
		expect(result.label).toBe("irregular");
	});

	it("ignores prereleases and drafts (only prereleases)", () => {
		const releases: ReleaseData[] = [
			release("2024-01-01T00:00:00Z", true, false),
			release("2024-02-01T00:00:00Z", true, false),
		];
		const result = computeReleaseCadence(releases);
		expect(result).toEqual({
			averageIntervalDays: null,
			regularityScore: 0,
			label: "stalled",
			score: 0,
		});
	});
});
