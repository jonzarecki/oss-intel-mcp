import type { ReviewDepth, ScorecardData, SecurityResult, SecuritySubScore } from "./types.js";

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

export interface MergedPRData {
	requestedReviewerCount: number;
}

/**
 * Computes a normalized 0-100 security score from OpenSSF Scorecard checks.
 * Optionally includes review depth from actual PR data to supplement
 * Scorecard's Code Review check which only verifies PRs exist, not review quality.
 * Returns null if no scorecard data is available.
 */
export function computeSecurity(
	scorecard: ScorecardData | null,
	mergedPRs?: MergedPRData[],
): SecurityResult | null {
	if (!scorecard) return null;

	const subScores: SecuritySubScore[] = [];
	let weightedSum = 0;
	let totalWeight = 0;

	const reviewDepth = mergedPRs ? computeReviewDepth(mergedPRs) : null;

	for (const check of scorecard.checks) {
		const config = RELEVANT_CHECKS[check.name];
		if (!config) continue;

		if (check.score < 0) continue;

		let adjustedScore = check.score;
		let reason = check.reason;

		if (check.name === "Code-Review" && reviewDepth) {
			adjustedScore = adjustCodeReviewScore(check.score, reviewDepth);
			if (adjustedScore !== check.score) {
				reason = `${check.reason} [adjusted: ${reviewDepth.reviewerAssignmentRate === 0 ? "no" : `${Math.round(reviewDepth.reviewerAssignmentRate * 100)}%`} reviewers assigned → ${reviewDepth.label}]`;
			}
		}

		const normalized = (adjustedScore / 10) * config.weight;
		weightedSum += normalized;
		totalWeight += config.weight;

		subScores.push({
			name: config.category,
			score: adjustedScore,
			maxScore: 10,
			reason,
		});
	}

	const overallScore =
		totalWeight > 0
			? Math.round((weightedSum / totalWeight) * 100)
			: Math.round(scorecard.overallScore * 10);

	return {
		overallScore,
		subScores,
		reviewDepth,
		score: Math.max(0, Math.min(100, overallScore)),
	};
}

function computeReviewDepth(mergedPRs: MergedPRData[]): ReviewDepth {
	if (mergedPRs.length === 0) {
		return { reviewerAssignmentRate: 0, label: "unknown" };
	}

	const withReviewers = mergedPRs.filter((pr) => pr.requestedReviewerCount > 0).length;
	const rate = withReviewers / mergedPRs.length;

	let label: ReviewDepth["label"];
	if (rate >= 0.8) {
		label = "thorough";
	} else if (rate >= 0.4) {
		label = "partial";
	} else {
		label = "rubber-stamp";
	}

	return {
		reviewerAssignmentRate: Math.round(rate * 1000) / 1000,
		label,
	};
}

function adjustCodeReviewScore(scorecardScore: number, depth: ReviewDepth): number {
	if (depth.label === "thorough") return scorecardScore;
	if (depth.label === "partial") return Math.min(scorecardScore, 6);
	if (depth.label === "rubber-stamp") return Math.min(scorecardScore, 3);
	return scorecardScore;
}
