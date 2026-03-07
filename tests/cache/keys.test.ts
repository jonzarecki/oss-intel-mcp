import { describe, expect, it } from "vitest";
import { cacheKey } from "../../src/cache/keys.js";

describe("cacheKey", () => {
	it("generates key from source and endpoint", () => {
		expect(cacheKey("github", "/repos/facebook/react")).toBe("github:/repos/facebook/react");
	});

	it("includes sorted params", () => {
		const key = cacheKey("github", "/repos/x/y/pulls", {
			state: "closed",
			per_page: 100,
			sort: "updated",
		});
		expect(key).toBe("github:/repos/x/y/pulls:per_page=100&sort=updated&state=closed");
	});

	it("omits params section when params is empty", () => {
		expect(cacheKey("deps-dev", "/projects/foo")).toBe("deps-dev:/projects/foo");
	});

	it("omits params section when params object is empty", () => {
		expect(cacheKey("scorecard", "/projects/bar", {})).toBe("scorecard:/projects/bar");
	});

	it("uses different namespaces for different sources", () => {
		const ghKey = cacheKey("github", "/repos/a/b");
		const ddKey = cacheKey("deps-dev", "/repos/a/b");
		expect(ghKey).not.toBe(ddKey);
	});

	it("handles boolean params", () => {
		expect(cacheKey("oss-insight", "/orgs", { exclude_unknown: true })).toBe(
			"oss-insight:/orgs:exclude_unknown=true",
		);
	});
});
