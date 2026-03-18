import type { CacheStore } from "../../src/cache/store.js";
import type { GitHubClient } from "../../src/github/client.js";

const NOW = "2024-06-15T12:00:00Z";
const WEEK_AGO = "2024-06-08T12:00:00Z";
const MONTH_AGO = "2024-05-15T12:00:00Z";

export function createMockGitHub(): GitHubClient {
	return {
		getRepo: async () => ({
			full_name: "test/repo",
			name: "repo",
			owner: { login: "test" },
			description: "A test repo",
			homepage: null,
			html_url: "https://github.com/test/repo",
			language: "TypeScript",
			license: { spdx_id: "MIT", name: "MIT License" },
			stargazers_count: 1000,
			forks_count: 100,
			open_issues_count: 20,
			created_at: "2020-01-01T00:00:00Z",
			updated_at: NOW,
			pushed_at: NOW,
			archived: false,
			disabled: false,
			topics: ["typescript"],
			default_branch: "main",
		}),
		getContributors: async () => [
			{ login: "alice", id: 1, avatar_url: "", contributions: 200, type: "User" },
			{ login: "bob", id: 2, avatar_url: "", contributions: 150, type: "User" },
			{ login: "charlie", id: 3, avatar_url: "", contributions: 80, type: "User" },
			{ login: "diana", id: 4, avatar_url: "", contributions: 40, type: "User" },
			{ login: "eve", id: 5, avatar_url: "", contributions: 30, type: "User" },
		],
		getCommitActivity: async () => {
			const weeks = [];
			const nowTs = Math.floor(new Date(NOW).getTime() / 1000);
			for (let i = 25; i >= 0; i--) {
				weeks.push({
					week: nowTs - i * 7 * 24 * 3600,
					total: i < 13 ? 10 : 8,
					days: [1, 2, 1, 2, 1, 2, 1],
				});
			}
			return weeks;
		},
		getPulls: async () => [
			{
				number: 1,
				title: "Fix bug",
				state: "closed",
				created_at: MONTH_AGO,
				updated_at: WEEK_AGO,
				closed_at: WEEK_AGO,
				merged_at: WEEK_AGO,
				user: { login: "alice" },
				requested_reviewers: [],
				labels: [],
			},
			{
				number: 2,
				title: "Add feature",
				state: "closed",
				created_at: MONTH_AGO,
				updated_at: WEEK_AGO,
				closed_at: WEEK_AGO,
				merged_at: WEEK_AGO,
				user: { login: "bob" },
				requested_reviewers: [],
				labels: [],
			},
			{
				number: 3,
				title: "Update docs",
				state: "closed",
				created_at: MONTH_AGO,
				updated_at: WEEK_AGO,
				closed_at: WEEK_AGO,
				merged_at: null,
				user: { login: "charlie" },
				requested_reviewers: [],
				labels: [],
			},
		],
		getIssues: async () => [
			{
				number: 10,
				title: "Bug",
				state: "closed",
				created_at: MONTH_AGO,
				updated_at: WEEK_AGO,
				closed_at: WEEK_AGO,
				user: { login: "diana" },
				labels: [],
				comments: 2,
			},
			{
				number: 11,
				title: "Feature request",
				state: "open",
				created_at: WEEK_AGO,
				updated_at: NOW,
				closed_at: null,
				user: { login: "eve" },
				labels: [{ name: "good first issue" }],
				comments: 0,
			},
		],
		getIssueComments: async () => [
			{
				id: 1,
				user: { login: "alice" },
				created_at: WEEK_AGO,
				author_association: "MEMBER",
			},
		],
		getReleases: async () => [
			{
				tag_name: "v2.0.0",
				name: "v2.0.0",
				published_at: WEEK_AGO,
				created_at: WEEK_AGO,
				prerelease: false,
				draft: false,
			},
			{
				tag_name: "v1.0.0",
				name: "v1.0.0",
				published_at: MONTH_AGO,
				created_at: MONTH_AGO,
				prerelease: false,
				draft: false,
			},
		],
		getRecentCommitEmails: async () => [
			{ login: "alice", email: "alice@google.com", name: "Alice" },
			{ login: "bob", email: "bob@gmail.com", name: "Bob" },
			{ login: "charlie", email: "charlie@microsoft.com", name: "Charlie" },
		],
		getUserProfile: async (username: string) => ({
			login: username,
			name: username,
			company: username === "alice" ? "@google" : null,
			email: null,
			bio: null,
			blog: null,
			avatar_url: "",
		}),
		getIssueCount: async () => 10,
		getUserOrgs: async () => [],
		getCommitCountsFallback: async () => [],
		getRateLimit: () => ({ remaining: 4500, limit: 5000, resetAt: "2024-06-15T13:00:00Z" }),
	} as unknown as GitHubClient;
}

export function createMockCache(): CacheStore {
	const store = new Map<string, { value: string; expires_at: number }>();
	return {
		get: <T>(key: string): T | null => {
			const entry = store.get(key);
			if (!entry || entry.expires_at <= Date.now()) return null;
			return JSON.parse(entry.value) as T;
		},
		set: (key: string, value: unknown, ttlMs: number) => {
			store.set(key, {
				value: JSON.stringify(value),
				expires_at: Date.now() + ttlMs,
			});
		},
		has: (key: string) => store.has(key),
		delete: (key: string) => {
			store.delete(key);
		},
		clear: () => store.clear(),
		purgeExpired: () => 0,
		close: () => {},
	} as unknown as CacheStore;
}
