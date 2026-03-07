/**
 * Generates a deterministic cache key for a given endpoint and params.
 * Keys are namespaced by source to avoid collisions between GitHub and external APIs.
 */
export function cacheKey(
	source: "github" | "deps-dev" | "scorecard" | "oss-insight",
	endpoint: string,
	params?: Record<string, string | number | boolean>,
): string {
	const parts = [source, endpoint];

	if (params) {
		const sorted = Object.keys(params)
			.sort()
			.map((k) => `${k}=${String(params[k])}`)
			.join("&");
		if (sorted) {
			parts.push(sorted);
		}
	}

	return parts.join(":");
}
