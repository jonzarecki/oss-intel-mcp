import { cacheKey } from "../cache/keys.js";
import type { CacheStore } from "../cache/store.js";
import { fetchWithTimeout } from "./fetch-with-timeout.js";
import type { OSSInsightOrgData, OSSInsightOrgRow } from "./types.js";

const TTL = 24 * 60 * 60 * 1000; // 24 hours
const BASE_URL = "https://api.ossinsight.io/v1";

/**
 * Fetches pre-computed contributor organization data from OSS Insight.
 * Returns null on any failure (API down, repo not indexed, timeout).
 */
export async function getContributorOrgs(
	owner: string,
	repo: string,
	cache: CacheStore,
): Promise<OSSInsightOrgData | null> {
	const key = cacheKey("oss-insight", `/repos/${owner}/${repo}/pr_creator_orgs`);
	const cached = cache.get<OSSInsightOrgData>(key);
	if (cached) return cached;

	const response = await fetchWithTimeout(
		`${BASE_URL}/repos/${owner}/${repo}/pull_request_creators/organizations`,
	);
	if (!response) return null;

	try {
		const raw = (await response.json()) as Record<string, unknown>;
		const result = normalizeOSSInsightResponse(raw);
		if (!result) return null;
		cache.set(key, result, TTL);
		return result;
	} catch {
		return null;
	}
}

function normalizeOSSInsightResponse(raw: Record<string, unknown>): OSSInsightOrgData | null {
	const data = raw.data as Record<string, unknown> | undefined;
	if (!data) return null;

	const rows = data.rows as Array<Record<string, unknown>> | undefined;
	if (!Array.isArray(rows)) return null;

	const normalized: OSSInsightOrgRow[] = rows
		.filter((r) => r.org_name && typeof r.org_name === "string")
		.map((r) => ({
			org_name: String(r.org_name),
			pull_request_creators: String(r.pull_request_creators ?? "0"),
			percentage: String(r.percentage ?? "0"),
		}));

	const totalCreators = normalized.reduce(
		(sum, r) => sum + Number.parseInt(r.pull_request_creators, 10),
		0,
	);

	return { rows: normalized, totalCreators };
}
