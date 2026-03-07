import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CacheStore } from "../../src/cache/store.js";
import { getContributorOrgs } from "../../src/external/oss-insight.js";

describe("oss-insight client", () => {
	let cache: CacheStore;
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "oss-insight-test-"));
		cache = new CacheStore(join(tempDir, "cache.db"));
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		cache.close();
		rmSync(tempDir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("returns parsed org data", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					type: "sql_endpoint",
					data: {
						columns: [],
						rows: [
							{ org_name: "google", pull_request_creators: "10", percentage: "0.05" },
							{ org_name: "microsoft", pull_request_creators: "8", percentage: "0.04" },
						],
					},
				}),
				{ status: 200 },
			),
		);

		const result = await getContributorOrgs("test", "repo", cache);
		expect(result).not.toBeNull();
		expect(result?.rows).toHaveLength(2);
		expect(result?.rows[0]?.org_name).toBe("google");
		expect(result?.totalCreators).toBe(18);
	});

	it("returns null on fetch failure", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("fail"));
		const result = await getContributorOrgs("test", "repo", cache);
		expect(result).toBeNull();
	});

	it("returns null when response has no data", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ type: "error" }), { status: 200 }),
		);
		const result = await getContributorOrgs("test", "repo", cache);
		expect(result).toBeNull();
	});
});
