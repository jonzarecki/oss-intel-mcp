import { Octokit } from "@octokit/rest";
import { cacheKey } from "../cache/keys.js";
import type { CacheStore } from "../cache/store.js";
import { log } from "../logger.js";
import type {
	CommitActivityWeek,
	CommitAuthorEmail,
	GitHubContributor,
	GitHubIssue,
	GitHubIssueComment,
	GitHubOrg,
	GitHubPullRequest,
	GitHubRelease,
	GitHubRepo,
	GitHubUser,
} from "./types.js";

const TTL = {
	REPO: 5 * 60 * 1000,
	CONTRIBUTORS: 60 * 60 * 1000,
	COMMIT_STATS: 6 * 60 * 60 * 1000,
	PULLS: 60 * 60 * 1000,
	ISSUES: 60 * 60 * 1000,
	RELEASES: 60 * 60 * 1000,
	USER: 24 * 60 * 60 * 1000,
} as const;

const STATS_RETRY_DELAY_MS = 2000;
const STATS_MAX_RETRIES = 3;

function isNotFoundError(error: unknown): boolean {
	if (error && typeof error === "object" && "status" in error) {
		return (error as { status: number }).status === 404;
	}
	return false;
}

function toMondayTimestamp(date: Date): number {
	const d = new Date(date);
	d.setUTCHours(0, 0, 0, 0);
	const day = d.getUTCDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setUTCDate(d.getUTCDate() + diff);
	return Math.floor(d.getTime() / 1000);
}

export interface RateLimitInfo {
	remaining: number;
	limit: number;
	resetAt: string;
}

export class GitHubClient {
	private octokit: Octokit;
	private cache: CacheStore;
	private lastRateLimit: RateLimitInfo | null = null;

	constructor(token: string, cache: CacheStore) {
		this.octokit = new Octokit({ auth: token });
		this.octokit.hook.after("request", (response) => {
			const headers = response.headers as Record<string, string | undefined>;
			const remaining = headers["x-ratelimit-remaining"];
			if (remaining !== undefined) {
				this.lastRateLimit = {
					remaining: Number(remaining),
					limit: Number(headers["x-ratelimit-limit"]),
					resetAt: new Date(Number(headers["x-ratelimit-reset"]) * 1000).toISOString(),
				};
				if (this.lastRateLimit.remaining < 100) {
					log.warn("GitHub rate limit low", { ...this.lastRateLimit });
				}
			}
		});
		this.cache = cache;
	}

	getRateLimit(): RateLimitInfo | null {
		return this.lastRateLimit;
	}

	async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
		const key = cacheKey("github", `/repos/${owner}/${repo}`);
		const cached = this.cache.get<GitHubRepo>(key);
		if (cached) {
			log.debug("cache hit", { endpoint: "getRepo", owner, repo });
			return cached;
		}

		log.debug("cache miss, fetching", { endpoint: "getRepo", owner, repo });
		const { data } = await this.octokit.repos.get({ owner, repo });
		const result = data as unknown as GitHubRepo;
		this.cache.set(key, result, TTL.REPO);
		return result;
	}

	async getContributors(owner: string, repo: string, perPage = 100): Promise<GitHubContributor[]> {
		const key = cacheKey("github", `/repos/${owner}/${repo}/contributors`, {
			per_page: perPage,
		});
		const cached = this.cache.get<GitHubContributor[]>(key);
		if (cached) return cached;

		try {
			const { data } = await this.octokit.repos.listContributors({
				owner,
				repo,
				per_page: perPage,
			});
			const result = (data ?? []) as unknown as GitHubContributor[];
			this.cache.set(key, result, TTL.CONTRIBUTORS);
			return result;
		} catch (error) {
			if (isNotFoundError(error)) return [];
			throw error;
		}
	}

	async getCommitActivity(owner: string, repo: string): Promise<CommitActivityWeek[]> {
		const key = cacheKey("github", `/repos/${owner}/${repo}/stats/commit_activity`);
		const cached = this.cache.get<CommitActivityWeek[]>(key);
		if (cached) return cached;

		try {
			const data = await this.fetchStatsEndpoint<CommitActivityWeek[]>(() =>
				this.octokit.repos.getCommitActivityStats({ owner, repo }),
			);
			const result = data ?? [];
			if (result.length > 0) {
				this.cache.set(key, result, TTL.COMMIT_STATS);
			}
			return result;
		} catch (error) {
			if (isNotFoundError(error)) return [];
			throw error;
		}
	}

	async getPulls(
		owner: string,
		repo: string,
		state: "open" | "closed" | "all" = "closed",
		perPage = 100,
	): Promise<GitHubPullRequest[]> {
		const key = cacheKey("github", `/repos/${owner}/${repo}/pulls`, {
			state,
			per_page: perPage,
			sort: "updated",
		});
		const cached = this.cache.get<GitHubPullRequest[]>(key);
		if (cached) return cached;

		try {
			const { data } = await this.octokit.pulls.list({
				owner,
				repo,
				state,
				sort: "updated",
				direction: "desc",
				per_page: perPage,
			});
			const result = data as unknown as GitHubPullRequest[];
			this.cache.set(key, result, TTL.PULLS);
			return result;
		} catch (error) {
			if (isNotFoundError(error)) return [];
			throw error;
		}
	}

	async getIssues(
		owner: string,
		repo: string,
		state: "open" | "closed" | "all" = "closed",
		perPage = 100,
	): Promise<GitHubIssue[]> {
		const key = cacheKey("github", `/repos/${owner}/${repo}/issues`, {
			state,
			per_page: perPage,
			sort: "updated",
		});
		const cached = this.cache.get<GitHubIssue[]>(key);
		if (cached) return cached;

		try {
			const { data } = await this.octokit.issues.listForRepo({
				owner,
				repo,
				state,
				sort: "updated",
				direction: "desc",
				per_page: perPage,
			});
			const issues = data.filter((i) => !i.pull_request) as unknown as GitHubIssue[];
			this.cache.set(key, issues, TTL.ISSUES);
			return issues;
		} catch (error) {
			if (isNotFoundError(error)) return [];
			throw error;
		}
	}

	async getIssueComments(
		owner: string,
		repo: string,
		issueNumber: number,
	): Promise<GitHubIssueComment[]> {
		const key = cacheKey("github", `/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
		const cached = this.cache.get<GitHubIssueComment[]>(key);
		if (cached) return cached;

		try {
			const { data } = await this.octokit.issues.listComments({
				owner,
				repo,
				issue_number: issueNumber,
				per_page: 10,
			});
			const result = data as unknown as GitHubIssueComment[];
			this.cache.set(key, result, TTL.ISSUES);
			return result;
		} catch (error) {
			if (isNotFoundError(error)) return [];
			throw error;
		}
	}

	async getReleases(owner: string, repo: string, perPage = 10): Promise<GitHubRelease[]> {
		const key = cacheKey("github", `/repos/${owner}/${repo}/releases`, {
			per_page: perPage,
		});
		const cached = this.cache.get<GitHubRelease[]>(key);
		if (cached) return cached;

		try {
			const { data } = await this.octokit.repos.listReleases({
				owner,
				repo,
				per_page: perPage,
			});
			const result = data as unknown as GitHubRelease[];
			this.cache.set(key, result, TTL.RELEASES);
			return result;
		} catch (error) {
			if (isNotFoundError(error)) return [];
			throw error;
		}
	}

	async getRecentCommitEmails(
		owner: string,
		repo: string,
		perPage = 100,
	): Promise<CommitAuthorEmail[]> {
		const key = cacheKey("github", `/repos/${owner}/${repo}/commits/emails`, {
			per_page: perPage,
		});
		const cached = this.cache.get<CommitAuthorEmail[]>(key);
		if (cached) return cached;

		try {
			const { data } = await this.octokit.repos.listCommits({
				owner,
				repo,
				per_page: perPage,
			});
			const seen = new Set<string>();
			const result: CommitAuthorEmail[] = [];
			for (const commit of data) {
				const email = commit.commit?.author?.email;
				const name = commit.commit?.author?.name ?? "";
				if (!email || seen.has(email)) continue;
				if (email.endsWith("noreply.github.com")) continue;
				seen.add(email);
				result.push({
					login: commit.author?.login ?? null,
					email,
					name,
				});
			}
			this.cache.set(key, result, TTL.CONTRIBUTORS);
			return result;
		} catch (error) {
			if (isNotFoundError(error)) return [];
			throw error;
		}
	}

	async getUserProfile(username: string): Promise<GitHubUser> {
		const key = cacheKey("github", `/users/${username}`);
		const cached = this.cache.get<GitHubUser>(key);
		if (cached) return cached;

		const { data } = await this.octokit.users.getByUsername({ username });
		const result = data as unknown as GitHubUser;
		this.cache.set(key, result, TTL.USER);
		return result;
	}

	async getCommitCountsFallback(
		owner: string,
		repo: string,
		since?: Date,
	): Promise<CommitActivityWeek[]> {
		const sinceDate = since ?? new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
		const sinceISO = sinceDate.toISOString();
		const key = cacheKey("github", `/repos/${owner}/${repo}/commits/weekly-counts`, {
			since: sinceISO,
		});
		const cached = this.cache.get<CommitActivityWeek[]>(key);
		if (cached) return cached;

		try {
			const weekCounts = new Map<number, number>();
			const maxPages = 10;

			for (let page = 1; page <= maxPages; page++) {
				const { data } = await this.octokit.repos.listCommits({
					owner,
					repo,
					since: sinceISO,
					per_page: 100,
					page,
				});
				if (data.length === 0) break;

				for (const commit of data) {
					const dateStr = commit.commit?.author?.date ?? commit.commit?.committer?.date;
					if (!dateStr) continue;
					const weekStart = toMondayTimestamp(new Date(dateStr));
					weekCounts.set(weekStart, (weekCounts.get(weekStart) ?? 0) + 1);
				}

				if (data.length < 100) break;
			}

			const result: CommitActivityWeek[] = Array.from(weekCounts.entries())
				.sort(([a], [b]) => a - b)
				.map(([week, total]) => ({ week, total, days: [] }));

			if (result.length > 0) {
				this.cache.set(key, result, TTL.COMMIT_STATS);
			}
			return result;
		} catch {
			return [];
		}
	}

	async getUserOrgs(username: string): Promise<string[]> {
		const key = cacheKey("github", `/users/${username}/orgs`);
		const cached = this.cache.get<string[]>(key);
		if (cached) return cached;

		try {
			const { data } = await this.octokit.orgs.listForUser({
				username,
				per_page: 100,
			});
			const result = (data as unknown as GitHubOrg[]).map((o) => o.login);
			this.cache.set(key, result, TTL.USER);
			return result;
		} catch {
			return [];
		}
	}

	/**
	 * GitHub stats endpoints return 202 when computing in background.
	 * Retry up to STATS_MAX_RETRIES times with a delay.
	 */
	private async fetchStatsEndpoint<T>(
		fetcher: () => Promise<{ status: number; data: unknown }>,
	): Promise<T | null> {
		for (let attempt = 0; attempt < STATS_MAX_RETRIES; attempt++) {
			const response = await fetcher();
			if (response.status === 200) {
				return response.data as T;
			}
			if (response.status === 202) {
				await this.delay(STATS_RETRY_DELAY_MS);
				continue;
			}
			return null;
		}
		return null;
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
