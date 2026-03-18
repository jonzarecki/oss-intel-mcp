import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CacheStore } from "../../src/cache/store.js";
import { GitHubClient } from "../../src/github/client.js";

vi.mock("@octokit/rest", () => {
	return {
		Octokit: vi.fn().mockImplementation(() => ({
			hook: { after: vi.fn() },
			repos: {
				get: vi.fn().mockResolvedValue({
					status: 200,
					data: {
						full_name: "test/repo",
						name: "repo",
						owner: { login: "test" },
						stargazers_count: 100,
						forks_count: 10,
						open_issues_count: 5,
						description: "A test repo",
						language: "TypeScript",
						license: { spdx_id: "MIT", name: "MIT License" },
						created_at: "2020-01-01T00:00:00Z",
						updated_at: "2024-01-01T00:00:00Z",
						pushed_at: "2024-01-01T00:00:00Z",
						archived: false,
						disabled: false,
						topics: [],
						default_branch: "main",
						homepage: null,
						html_url: "https://github.com/test/repo",
					},
				}),
				listContributors: vi.fn().mockResolvedValue({
					status: 200,
					data: [
						{ login: "alice", id: 1, contributions: 100, avatar_url: "", type: "User" },
						{ login: "bob", id: 2, contributions: 50, avatar_url: "", type: "User" },
					],
				}),
				getCommitActivityStats: vi.fn().mockResolvedValue({
					status: 200,
					data: [{ week: 1700000000, total: 10, days: [1, 2, 3, 1, 1, 1, 1] }],
				}),
				listCommits: vi.fn().mockResolvedValue({
					status: 200,
					data: [
						{
							commit: {
								author: { email: "alice@google.com", name: "Alice", date: "2024-06-10T10:00:00Z" },
							},
							author: { login: "alice" },
						},
						{
							commit: {
								author: { email: "bob@gmail.com", name: "Bob", date: "2024-06-11T10:00:00Z" },
							},
							author: { login: "bob" },
						},
					],
				}),
				listReleases: vi.fn().mockResolvedValue({
					status: 200,
					data: [
						{
							tag_name: "v1.0.0",
							name: "v1.0.0",
							published_at: "2024-01-01T00:00:00Z",
							created_at: "2024-01-01T00:00:00Z",
							prerelease: false,
							draft: false,
						},
					],
				}),
			},
			pulls: {
				list: vi.fn().mockResolvedValue({
					status: 200,
					data: [
						{
							number: 1,
							title: "Fix bug",
							state: "closed",
							created_at: "2024-01-01T00:00:00Z",
							updated_at: "2024-01-02T00:00:00Z",
							closed_at: "2024-01-02T00:00:00Z",
							merged_at: "2024-01-02T00:00:00Z",
							user: { login: "alice" },
							requested_reviewers: [],
							labels: [],
						},
					],
				}),
			},
			issues: {
				listForRepo: vi.fn().mockResolvedValue({
					status: 200,
					data: [
						{
							number: 10,
							title: "Bug report",
							state: "closed",
							created_at: "2024-01-01T00:00:00Z",
							updated_at: "2024-01-03T00:00:00Z",
							closed_at: "2024-01-03T00:00:00Z",
							user: { login: "bob" },
							labels: [],
							comments: 2,
						},
					],
				}),
				listComments: vi.fn().mockResolvedValue({
					status: 200,
					data: [
						{
							id: 1,
							user: { login: "alice" },
							created_at: "2024-01-02T00:00:00Z",
							author_association: "MEMBER",
						},
					],
				}),
			},
			users: {
				getByUsername: vi.fn().mockResolvedValue({
					status: 200,
					data: {
						login: "alice",
						name: "Alice",
						company: "Acme Corp",
						email: null,
						bio: "Developer",
						blog: "",
						avatar_url: "",
					},
				}),
			},
			orgs: {
				listForUser: vi.fn().mockResolvedValue({
					status: 200,
					data: [{ login: "test-org" }],
				}),
			},
		})),
	};
});

describe("GitHubClient", () => {
	let client: GitHubClient;
	let cache: CacheStore;
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "gh-client-test-"));
		cache = new CacheStore(join(tempDir, "cache.db"));
		client = new GitHubClient("fake-token", cache);
	});

	afterEach(() => {
		cache.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("fetches repo metadata", async () => {
		const repo = await client.getRepo("test", "repo");
		expect(repo.full_name).toBe("test/repo");
		expect(repo.stargazers_count).toBe(100);
	});

	it("caches repo metadata on second call", async () => {
		await client.getRepo("test", "repo");
		const repo2 = await client.getRepo("test", "repo");
		expect(repo2.full_name).toBe("test/repo");
	});

	it("fetches contributors", async () => {
		const contributors = await client.getContributors("test", "repo");
		expect(contributors).toHaveLength(2);
		expect(contributors[0]?.login).toBe("alice");
	});

	it("fetches commit activity", async () => {
		const activity = await client.getCommitActivity("test", "repo");
		expect(activity).toHaveLength(1);
		expect(activity[0]?.total).toBe(10);
	});

	it("fetches pull requests", async () => {
		const pulls = await client.getPulls("test", "repo");
		expect(pulls).toHaveLength(1);
		expect(pulls[0]?.merged_at).toBeTruthy();
	});

	it("fetches issues (filtering out PRs)", async () => {
		const issues = await client.getIssues("test", "repo");
		expect(issues).toHaveLength(1);
		expect(issues[0]?.number).toBe(10);
	});

	it("fetches releases", async () => {
		const releases = await client.getReleases("test", "repo");
		expect(releases).toHaveLength(1);
		expect(releases[0]?.tag_name).toBe("v1.0.0");
	});

	it("fetches user profiles", async () => {
		const user = await client.getUserProfile("alice");
		expect(user.company).toBe("Acme Corp");
	});

	it("fetches user org memberships", async () => {
		const orgs = await client.getUserOrgs("alice");
		expect(orgs).toEqual(["test-org"]);
	});

	it("returns empty array when getUserOrgs fails", async () => {
		const { Octokit } = await import("@octokit/rest");
		const instance = new Octokit();
		(instance.orgs.listForUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("forbidden"),
		);
		const orgs = await client.getUserOrgs("private-user");
		expect(Array.isArray(orgs)).toBe(true);
	});

	it("getCommitCountsFallback returns weekly grouped data", async () => {
		const result = await client.getCommitCountsFallback("test", "repo");
		expect(result.length).toBeGreaterThan(0);
		for (const week of result) {
			expect(week.week).toBeTypeOf("number");
			expect(week.total).toBeGreaterThan(0);
		}
	});

	it("getCommitCountsFallback caches results", async () => {
		const first = await client.getCommitCountsFallback("test", "repo");
		const second = await client.getCommitCountsFallback("test", "repo");
		expect(first).toEqual(second);
	});

	it("getCommitCountsFallback respects since parameter", async () => {
		const since = new Date("2024-06-01T00:00:00Z");
		const result = await client.getCommitCountsFallback("test", "since-repo", since);
		expect(result.length).toBeGreaterThan(0);
		for (const week of result) {
			expect(week.week).toBeGreaterThanOrEqual(Math.floor(since.getTime() / 1000) - 7 * 86400);
		}
	});
});
