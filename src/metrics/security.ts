import type { ScorecardData, SecurityResult, SecuritySubScore } from "./types.js";

const RELEVANT_CHECKS: Record<string, { weight: number; category: string }> = {
	Vulnerabilities: { weight: 20, category: "Vulnerabilities" },
	"CI-Tests": { weight: 15, category: "CI/Tests" },
	"Code-Review": { weight: 15, category: "Code Review" },
	"Security-Policy": { weight: 10, category: "Security Policy" },
	SAST: { weight: 10, category: "SAST" },
	"Dependency-Update-Tool": { weight: 10, category: "Dependency Updates" },
	Maintained: { weight: 10, category: "Maintained" },
	"Token-Permissions": { weight: 5, category: "Token Permissions" },
	"Dangerous-Workflow": { weight: 5, category: "Dangerous Workflows" },
};

/**
 * Computes a normalized 0-100 security score from OpenSSF Scorecard checks.
 * Returns null if no scorecard data is available.
 */
export function computeSecurity(scorecard: ScorecardData | null): SecurityResult | null {
	if (!scorecard) return null;

	const subScores: SecuritySubScore[] = [];
	let weightedSum = 0;
	let totalWeight = 0;

	for (const check of scorecard.checks) {
		const config = RELEVANT_CHECKS[check.name];
		if (!config) continue;

		// Scorecard checks score from -1 (error/N/A) to 10
		// Treat -1 as excluded from scoring
		if (check.score < 0) continue;

		const normalized = (check.score / 10) * config.weight;
		weightedSum += normalized;
		totalWeight += config.weight;

		subScores.push({
			name: config.category,
			score: check.score,
			maxScore: 10,
			reason: check.reason,
		});
	}

	const overallScore =
		totalWeight > 0
			? Math.round((weightedSum / totalWeight) * 100)
			: Math.round(scorecard.overallScore * 10);

	return {
		overallScore,
		subScores,
		score: Math.max(0, Math.min(100, overallScore)),
	};
}
