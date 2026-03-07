import { cacheKey } from "../cache/keys.js";
import type { CacheStore } from "../cache/store.js";
import { fetchWithTimeout } from "./fetch-with-timeout.js";
import type { DepsDevProject, ScorecardCheck } from "./types.js";

const TTL = 6 * 60 * 60 * 1000; // 6 hours
const BASE_URL = "https://api.deps.dev/v3";

export async function getProjectInfo(
	owner: string,
	repo: string,
	cache: CacheStore,
): Promise<DepsDevProject | null> {
	const key = cacheKey("deps-dev", `/projects/${owner}/${repo}`);
	const cached = cache.get<DepsDevProject>(key);
	if (cached) return cached;

	const encoded = encodeURIComponent(`github.com/${owner}/${repo}`);
	const response = await fetchWithTimeout(`${BASE_URL}/projects/${encoded}`);
	if (!response) return null;

	try {
		const raw = (await response.json()) as Record<string, unknown>;
		const result = normalizeDepsDevResponse(raw);
		cache.set(key, result, TTL);
		return result;
	} catch {
		return null;
	}
}

function normalizeDepsDevResponse(raw: Record<string, unknown>): DepsDevProject {
	const scorecard = raw.scorecard as Record<string, unknown> | undefined;
	let normalizedScorecard: DepsDevProject["scorecard"] = null;

	if (scorecard && typeof scorecard.overallScore === "number") {
		const checks = (scorecard.checks as Array<Record<string, unknown>> | undefined) ?? [];
		normalizedScorecard = {
			date: String(scorecard.date ?? ""),
			overallScore: scorecard.overallScore,
			checks: checks.map(
				(c): ScorecardCheck => ({
					name: String(c.name ?? ""),
					score: typeof c.score === "number" ? c.score : -1,
					reason: String(c.reason ?? ""),
					documentation: normalizeDocumentation(c.documentation),
				}),
			),
		};
	}

	return {
		projectKey: raw.projectKey as { id: string },
		openIssuesCount: (raw.openIssuesCount as number) ?? 0,
		starsCount: (raw.starsCount as number) ?? 0,
		forksCount: (raw.forksCount as number) ?? 0,
		license: String(raw.license ?? ""),
		description: String(raw.description ?? ""),
		homepage: String(raw.homepage ?? ""),
		scorecard: normalizedScorecard,
	};
}

function normalizeDocumentation(doc: unknown): ScorecardCheck["documentation"] {
	if (!doc || typeof doc !== "object") return { url: "" };
	const d = doc as Record<string, unknown>;
	return {
		short: (d.short as string | undefined) ?? (d.shortDescription as string | undefined),
		shortDescription: (d.shortDescription as string | undefined) ?? (d.short as string | undefined),
		url: String(d.url ?? ""),
	};
}
