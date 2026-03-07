export interface GitHubRepo {
	full_name: string;
	name: string;
	owner: { login: string };
	description: string | null;
	homepage: string | null;
	html_url: string;
	language: string | null;
	license: { spdx_id: string; name: string } | null;
	stargazers_count: number;
	forks_count: number;
	open_issues_count: number;
	created_at: string;
	updated_at: string;
	pushed_at: string;
	archived: boolean;
	disabled: boolean;
	topics: string[];
	default_branch: string;
}

export interface GitHubContributor {
	login: string;
	id: number;
	avatar_url: string;
	contributions: number;
	type: string;
}

/** Weekly commit activity from /repos/{owner}/{repo}/stats/commit_activity */
export interface CommitActivityWeek {
	/** Unix timestamp for the start of the week */
	week: number;
	/** Total commits for the week */
	total: number;
	/** Daily commit counts (Sun=0, Sat=6) */
	days: number[];
}

/** Code frequency data from /repos/{owner}/{repo}/stats/code_frequency */
export type CodeFrequencyWeek = [timestamp: number, additions: number, deletions: number];

export interface GitHubPullRequest {
	number: number;
	title: string;
	state: string;
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	merged_at: string | null;
	user: { login: string } | null;
	requested_reviewers: { login: string }[];
	labels: { name: string }[];
}

export interface GitHubPullRequestWithReviews extends GitHubPullRequest {
	first_review_at: string | null;
}

export interface GitHubIssue {
	number: number;
	title: string;
	state: string;
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	user: { login: string } | null;
	labels: { name: string }[];
	pull_request?: unknown;
	comments: number;
}

export interface GitHubIssueComment {
	id: number;
	user: { login: string } | null;
	created_at: string;
	author_association: string;
}

export interface GitHubRelease {
	tag_name: string;
	name: string | null;
	published_at: string | null;
	created_at: string;
	prerelease: boolean;
	draft: boolean;
}

export interface GitHubUser {
	login: string;
	name: string | null;
	company: string | null;
	email: string | null;
	bio: string | null;
	blog: string | null;
	avatar_url: string;
}

export interface CommitAuthorEmail {
	login: string | null;
	email: string;
	name: string;
}
