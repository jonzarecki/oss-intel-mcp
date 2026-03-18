import { describe, expect, it, vi } from "vitest";
import type { CommitActivityWeek } from "../../src/github/types.js";
import { handleAnalyzeRepo, needsActivityFallback } from "../../src/tools/analyze-repo.js";
import { createMockCache, createMockGitHub } from "./helpers.js";

vi.mock("../../src/external/deps-dev.js", () => ({
	getProjectInfo: vi.fn().mockResolvedValue({
		projectKey: { id: "github.com/test/repo" },
		starsCount: 100,
		forksCount: 10,
		openIssuesCount: 5,
		license: "MIT",
		description: "Test",
		homepage: "",
		scorecard: {
			date: "2024-01-01",
			overallScore: 8.0,
			checks: [
				{ name: "Maintained", score: 10, reason: "active", documentation: { url: "" } },
				{ name: "Vulnerabilities", score: 10, reason: "none", documentation: { url: "" } },
				{ name: "CI-Tests", score: 9, reason: "all pass", documentation: { url: "" } },
				{ name: "Code-Review", score: 8, reason: "good", documentation: { url: "" } },
				{ name: "Security-Policy", score: 10, reason: "found", documentation: { url: "" } },
				{ name: "SAST", score: 7, reason: "codeql", documentation: { url: "" } },
				{
					name: "Dependency-Update-Tool",
					score: 10,
					reason: "dependabot",
					documentation: { url: "" },
				},
			],
		},
	}),
}));

vi.mock("../../src/external/scorecard.js", () => ({
	getScorecard: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../src/external/oss-insight.js", () => ({
	getContributorOrgs: vi.fn().mockResolvedValue({
		rows: [
			{ org_name: "google", pull_request_creators: "5", percentage: "0.10" },
			{ org_name: "microsoft", pull_request_creators: "3", percentage: "0.06" },
		],
		totalCreators: 8,
	}),
}));

describe("handleAnalyzeRepo", () => {
	it("returns a complete analysis result", async () => {
		const github = createMockGitHub();
		const cache = createMockCache();

		const result = await handleAnalyzeRepo("test", "repo", github, cache);

		expect(result.repo.fullName).toBe("test/repo");
		expect(result.repo.stars).toBe(1000);
		expect(result.verdict).toBeDefined();
		expect(result.verdict.verdict).toBeDefined();
		expect(result.verdict.score).toBeGreaterThanOrEqual(0);
		expect(result.verdict.score).toBeLessThanOrEqual(100);
		expect(result.metrics.busFactor).toBeDefined();
		expect(result.metrics.activityTrend).toBeDefined();
		expect(result.metrics.prHealth).toBeDefined();
		expect(result.metrics.issueHealth).toBeDefined();
		expect(result.metrics.releaseCadence).toBeDefined();
		expect(result.metrics.affiliation).toBeDefined();
		expect(result.metrics.security).toBeDefined();
		expect(result.enrichmentSources).toContain("deps.dev");
		expect(result.enrichmentSources).toContain("oss-insight");
	});

	it("uses commits fallback when stats returns empty and repo is active", async () => {
		const github = createMockGitHub();
		const cache = createMockCache();

		const recentPushedAt = new Date().toISOString();
		const originalGetRepo = github.getRepo.bind(github);
		(github as Record<string, unknown>).getRepo = async (o: string, r: string) => {
			const repo = await originalGetRepo(o, r);
			return { ...repo, pushed_at: recentPushedAt };
		};
		(github as Record<string, unknown>).getCommitActivity = async () => [];
		const nowTs = Math.floor(Date.now() / 1000);
		const weekStart = nowTs - (nowTs % (7 * 86400));
		(github as Record<string, unknown>).getCommitCountsFallback = async () => [
			{ week: weekStart - 7 * 86400, total: 25, days: [] },
			{ week: weekStart, total: 30, days: [] },
		];

		const result = await handleAnalyzeRepo("test", "repo", github, cache);

		expect(result.metrics.activityTrend.recentCommits).toBeGreaterThan(0);
		expect(result.enrichmentSources).toContain("github-commits-fallback");
	});
});

describe("needsActivityFallback", () => {
	const recentPushedAt = new Date().toISOString();
	const oldPushedAt = "2020-01-01T00:00:00Z";

	it("returns 'none' when data is valid and recent", () => {
		const nowTs = Math.floor(Date.now() / 1000);
		const data: CommitActivityWeek[] = [];
		for (let i = 25; i >= 0; i--) {
			data.push({ week: nowTs - i * 7 * 86400, total: 5, days: [] });
		}
		expect(needsActivityFallback(data, recentPushedAt)).toBe("none");
	});

	it("returns 'full' when data is empty and repo recently pushed", () => {
		expect(needsActivityFallback([], recentPushedAt)).toBe("full");
	});

	it("returns 'none' when data is empty but repo not recently pushed", () => {
		expect(needsActivityFallback([], oldPushedAt)).toBe("none");
	});

	it("returns 'supplement' when recent 13 weeks are all zeros", () => {
		const nowTs = Math.floor(Date.now() / 1000);
		const data: CommitActivityWeek[] = [];
		for (let i = 51; i >= 0; i--) {
			data.push({
				week: nowTs - i * 7 * 86400,
				total: i >= 13 ? 10 : 0,
				days: [],
			});
		}
		expect(needsActivityFallback(data, recentPushedAt)).toBe("supplement");
	});

	it("returns 'none' when recent weeks have some activity", () => {
		const nowTs = Math.floor(Date.now() / 1000);
		const data: CommitActivityWeek[] = [];
		for (let i = 25; i >= 0; i--) {
			data.push({
				week: nowTs - i * 7 * 86400,
				total: i < 13 ? 1 : 10,
				days: [],
			});
		}
		expect(needsActivityFallback(data, recentPushedAt)).toBe("none");
	});
});
