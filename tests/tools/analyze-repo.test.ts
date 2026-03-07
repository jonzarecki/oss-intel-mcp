import { describe, expect, it, vi } from "vitest";
import { handleAnalyzeRepo } from "../../src/tools/analyze-repo.js";
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
});
