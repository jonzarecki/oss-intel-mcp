export interface ScorecardCheck {
	name: string;
	score: number;
	reason: string;
	documentation: {
		short?: string;
		shortDescription?: string;
		url: string;
	};
}

export interface ScorecardResult {
	overallScore: number;
	checks: ScorecardCheck[];
	date: string;
	repo: string;
}

export interface DepsDevProject {
	projectKey: { id: string };
	openIssuesCount: number;
	starsCount: number;
	forksCount: number;
	license: string;
	description: string;
	homepage: string;
	scorecard: {
		date: string;
		overallScore: number;
		checks: ScorecardCheck[];
	} | null;
}

export interface OSSInsightOrgRow {
	org_name: string;
	pull_request_creators: string;
	percentage: string;
}

export interface OSSInsightOrgData {
	rows: OSSInsightOrgRow[];
	totalCreators: number;
}
