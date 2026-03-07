import { describe, expect, it, vi } from "vitest";
import { handleShouldContribute } from "../../src/tools/should-contribute.js";
import { createMockCache, createMockGitHub } from "./helpers.js";

vi.mock("../../src/external/oss-insight.js", () => ({
	getContributorOrgs: vi.fn().mockResolvedValue(null),
}));

describe("handleShouldContribute", () => {
	it("returns contributor analysis", async () => {
		const github = createMockGitHub();
		const cache = createMockCache();

		const result = await handleShouldContribute("test", "repo", github, cache);

		expect(result.repo).toBe("test/repo");
		expect(result.prHealth).toBeDefined();
		expect(result.prHealth.mergeRate).toBeGreaterThanOrEqual(0);
		expect(result.issueHealth).toBeDefined();
		expect(result.goodFirstIssueCount).toBeGreaterThanOrEqual(0);
		expect(result.contributorRetention).toBeDefined();
		expect(result.topMaintainers).toBeDefined();
		expect(result.topMaintainers.length).toBeGreaterThan(0);
	});
});
