import type { ScorecardCheck } from "../external/types.js";

// --- Input types ---

export interface ContributorData {
	login: string;
	contributions: number;
}

export interface WeeklyActivity {
	week: number;
	total: number;
}

export interface PullRequestData {
	created_at: string;
	closed_at: string | null;
	merged_at: string | null;
	first_review_at?: string | null;
}

export interface IssueData {
	number: number;
	created_at: string;
	closed_at: string | null;
	author_login: string | null;
	first_response_at: string | null;
}

export interface ReleaseData {
	published_at: string | null;
	created_at: string;
	prerelease: boolean;
	draft: boolean;
}

export interface UserProfileData {
	login: string;
	company: string | null;
	email: string | null;
	bio: string | null;
}

export interface OrgContributionData {
	org_name: string;
	contributor_count: number;
	percentage: number;
}

export interface AffiliationInput {
	userProfiles: UserProfileData[];
	ossInsightOrgs: OrgContributionData[] | null;
	contributorCommits: Map<string, number>;
	commitEmails: Map<string, string[]>;
}

export interface ScorecardData {
	overallScore: number;
	checks: ScorecardCheck[];
}

// --- Output types ---

export type TrendLabel = "growing" | "stable" | "declining";
export type HealthLabel = "healthy" | "moderate" | "concerning";
export type CadenceLabel = "regular" | "irregular" | "stalled";
export type VerdictLabel = "Safe to adopt" | "Use with caution" | "Risky";

export interface BusFactorResult {
	giniCoefficient: number;
	topContributorShare: number;
	top2Share: number;
	isHighRisk: boolean;
	score: number;
}

export interface ActivityTrendResult {
	trend: TrendLabel;
	percentageChange: number;
	recentCommits: number;
	previousCommits: number;
	score: number;
}

export interface PRHealthResult {
	mergeRate: number;
	medianTimeToMergeHours: number | null;
	medianTimeToFirstReviewHours: number | null;
	label: HealthLabel;
	score: number;
}

export interface IssueHealthResult {
	medianResponseTimeHours: number | null;
	closeRate: number;
	label: HealthLabel;
	score: number;
}

export interface ReleaseCadenceResult {
	averageIntervalDays: number | null;
	regularityScore: number;
	label: CadenceLabel;
	score: number;
}

export interface AffiliationEntry {
	login: string;
	organization: string;
	commits: number;
}

export interface OrgShare {
	organization: string;
	percentage: number;
	contributorCount: number;
}

export interface AffiliationResult {
	topContributors: AffiliationEntry[];
	orgShares: OrgShare[];
	corporatePercentage: number;
	elephantFactor: number;
	score: number;
}

export interface SecuritySubScore {
	name: string;
	score: number;
	maxScore: number;
	reason: string;
}

export interface SecurityResult {
	overallScore: number;
	subScores: SecuritySubScore[];
	score: number;
}

export interface VerdictResult {
	verdict: VerdictLabel;
	score: number;
	breakdown: {
		metric: string;
		score: number;
		weight: number;
		weightedScore: number;
	}[];
}

export interface AllMetrics {
	busFactor: BusFactorResult;
	activityTrend: ActivityTrendResult;
	prHealth: PRHealthResult;
	issueHealth: IssueHealthResult;
	releaseCadence: ReleaseCadenceResult;
	affiliation: AffiliationResult;
	security: SecurityResult | null;
}
