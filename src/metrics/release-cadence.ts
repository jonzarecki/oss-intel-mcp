import type { CadenceLabel, ReleaseCadenceResult, ReleaseData } from "./types.js";

export function computeReleaseCadence(releases: ReleaseData[]): ReleaseCadenceResult {
	const stable = releases.filter((r) => !r.prerelease && !r.draft && r.published_at);

	if (stable.length < 2) {
		return {
			averageIntervalDays: null,
			regularityScore: 0,
			label: "stalled",
			score: stable.length === 1 ? 20 : 0,
		};
	}

	const dates = stable.map((r) => new Date(r.published_at!).getTime()).sort((a, b) => b - a);

	const intervals: number[] = [];
	for (let i = 0; i < dates.length - 1; i++) {
		const daysDiff = ((dates[i] ?? 0) - (dates[i + 1] ?? 0)) / (1000 * 60 * 60 * 24);
		intervals.push(daysDiff);
	}

	const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;

	// Regularity: coefficient of variation (lower = more regular)
	const stddev = Math.sqrt(
		intervals.reduce((s, v) => s + (v - avgInterval) ** 2, 0) / intervals.length,
	);
	const cv = avgInterval > 0 ? stddev / avgInterval : 1;
	const regularityScore = Math.max(0, Math.round((1 - Math.min(cv, 1)) * 100));

	const label = classifyCadence(avgInterval, regularityScore);

	// Score: frequency (50%) + regularity (50%)
	// Best frequency: weekly-monthly (7-30 days). Penalize >180 days.
	const freqScore = avgInterval <= 30 ? 50 : avgInterval <= 90 ? 35 : avgInterval <= 180 ? 20 : 10;
	const regScore = regularityScore / 2;
	const score = Math.round(freqScore + regScore);

	return {
		averageIntervalDays: Math.round(avgInterval * 10) / 10,
		regularityScore,
		label,
		score: Math.max(0, Math.min(100, score)),
	};
}

function classifyCadence(avgDays: number, regularity: number): CadenceLabel {
	if (avgDays > 365) return "stalled";
	if (regularity >= 40) return "regular";
	return "irregular";
}
