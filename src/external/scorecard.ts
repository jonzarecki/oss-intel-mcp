import { cacheKey } from "../cache/keys.js";
import type { CacheStore } from "../cache/store.js";
import { fetchWithTimeout } from "./fetch-with-timeout.js";
import type { ScorecardCheck, ScorecardResult } from "./types.js";

const TTL = 6 * 60 * 60 * 1000; // 6 hours
const BASE_URL = "https://api.securityscorecards.dev";

/**
 * Fetches OpenSSF Scorecard data directly. Used as fallback when deps.dev
 * doesn't have scorecard data for a repo.
 */
export async function getScorecard(
	owner: string,
	repo: string,
	cache: CacheStore,
): Promise<ScorecardResult | null> {
	const key = cacheKey("scorecard", `/projects/${owner}/${repo}`);
	const cached = cache.get<ScorecardResult>(key);
	if (cached) return cached;

	const response = await fetchWithTimeout(`${BASE_URL}/projects/github.com/${owner}/${repo}`);
	if (!response) return null;

	try {
		const raw = (await response.json()) as Record<string, unknown>;
		const result = normalizeScorecardResponse(raw, owner, repo);
		if (!result) return null;
		cache.set(key, result, TTL);
		return result;
	} catch {
		return null;
	}
}

function normalizeScorecardResponse(
	raw: Record<string, unknown>,
	owner: string,
	repo: string,
): ScorecardResult | null {
	const score = raw.score;
	if (typeof score !== "number") return null;

	const checks = (raw.checks as Array<Record<string, unknown>> | undefined) ?? [];

	return {
		overallScore: score,
		date: String(raw.date ?? ""),
		repo: `${owner}/${repo}`,
		checks: checks.map(
			(c): ScorecardCheck => ({
				name: String(c.name ?? ""),
				score: typeof c.score === "number" ? c.score : -1,
				reason: String(c.reason ?? ""),
				documentation: normalizeDoc(c.documentation),
			}),
		),
	};
}

function normalizeDoc(doc: unknown): ScorecardCheck["documentation"] {
	if (!doc || typeof doc !== "object") return { url: "" };
	const d = doc as Record<string, unknown>;
	return {
		short: (d.short as string | undefined) ?? (d.shortDescription as string | undefined),
		shortDescription: (d.shortDescription as string | undefined) ?? (d.short as string | undefined),
		url: String(d.url ?? ""),
	};
}
