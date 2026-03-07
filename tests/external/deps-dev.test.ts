import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CacheStore } from "../../src/cache/store.js";
import { getProjectInfo } from "../../src/external/deps-dev.js";

describe("deps-dev client", () => {
	let cache: CacheStore;
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "deps-dev-test-"));
		cache = new CacheStore(join(tempDir, "cache.db"));
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		cache.close();
		rmSync(tempDir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("returns parsed project info with scorecard", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					projectKey: { id: "github.com/test/repo" },
					openIssuesCount: 10,
					starsCount: 500,
					forksCount: 50,
					license: "MIT",
					description: "Test",
					homepage: "",
					scorecard: {
						date: "2024-01-01",
						overallScore: 7.5,
						checks: [
							{
								name: "Maintained",
								score: 10,
								reason: "active",
								documentation: { shortDescription: "Is maintained", url: "https://example.com" },
							},
						],
					},
				}),
				{ status: 200 },
			),
		);

		const result = await getProjectInfo("test", "repo", cache);
		expect(result).not.toBeNull();
		expect(result?.starsCount).toBe(500);
		expect(result?.scorecard?.overallScore).toBe(7.5);
		expect(result?.scorecard?.checks).toHaveLength(1);
	});

	it("returns null on fetch failure", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("fail"));
		const result = await getProjectInfo("test", "repo", cache);
		expect(result).toBeNull();
	});

	it("returns cached data on second call", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					projectKey: { id: "github.com/test/repo" },
					openIssuesCount: 0,
					starsCount: 100,
					forksCount: 10,
					license: "MIT",
					description: "Cached",
					homepage: "",
					scorecard: null,
				}),
				{ status: 200 },
			),
		);

		await getProjectInfo("test", "repo", cache);
		vi.mocked(fetch).mockRejectedValue(new Error("should not be called"));
		const result = await getProjectInfo("test", "repo", cache);
		expect(result?.description).toBe("Cached");
	});
});
