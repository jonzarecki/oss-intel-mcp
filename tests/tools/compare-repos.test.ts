import { describe, expect, it, vi } from "vitest";
import { handleCompareRepos } from "../../src/tools/compare-repos.js";
import { createMockCache, createMockGitHub } from "./helpers.js";

vi.mock("../../src/external/deps-dev.js", () => ({
	getProjectInfo: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../src/external/scorecard.js", () => ({
	getScorecard: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../src/external/oss-insight.js", () => ({
	getContributorOrgs: vi.fn().mockResolvedValue(null),
}));

describe("handleCompareRepos", () => {
	it("returns comparison of two repos", async () => {
		const github = createMockGitHub();
		const cache = createMockCache();

		const result = await handleCompareRepos(
			[
				{ owner: "test", repo: "repo" },
				{ owner: "test", repo: "repo" },
			],
			github,
			cache,
		);

		expect(result.repos).toHaveLength(2);
		expect(result.comparison.length).toBeGreaterThan(0);
		expect(result.recommendation).toBeTruthy();

		for (const metric of result.comparison) {
			expect(metric.values).toHaveLength(2);
			expect(metric.winner).toBeTruthy();
		}
	});
});
