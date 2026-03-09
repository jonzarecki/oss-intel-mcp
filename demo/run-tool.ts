/**
 * CLI helper for the demo script. Runs MCP tools and prints formatted results.
 *
 * Usage:
 *   npx tsx demo/run-tool.ts analyze <owner> <repo>
 *   npx tsx demo/run-tool.ts contribute <owner> <repo>
 *   npx tsx demo/run-tool.ts compare <owner/repo> <owner/repo>
 *   npx tsx demo/run-tool.ts analyze <owner> <repo> --json   (raw JSON for fixture generation)
 *   npx tsx demo/run-tool.ts analyze <owner> <repo> --fixture <path>  (load from fixture)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { CacheStore } from "../src/cache/store.js";
import { GitHubClient } from "../src/github/client.js";
import { type AnalyzeRepoResult, handleAnalyzeRepo } from "../src/tools/analyze-repo.js";
import { type CompareReposResult, handleCompareRepos } from "../src/tools/compare-repos.js";
import {
	type ShouldContributeResult,
	handleShouldContribute,
} from "../src/tools/should-contribute.js";

// ── ANSI ────────────────────────────────────────────────────────────────────

const C = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",
	bgGreen: "\x1b[42m",
	bgYellow: "\x1b[43m",
	bgRed: "\x1b[41m",
};

function verdictColor(verdict: string): string {
	if (verdict === "Safe to adopt") return C.green;
	if (verdict === "Use with caution") return C.yellow;
	return C.red;
}

function verdictBg(verdict: string): string {
	if (verdict === "Safe to adopt") return C.bgGreen;
	if (verdict === "Use with caution") return C.bgYellow;
	return C.bgRed;
}

function scoreBar(score: number, width = 20): string {
	const filled = Math.round((score / 100) * width);
	const empty = width - filled;
	const color = score >= 70 ? C.green : score >= 40 ? C.yellow : C.red;
	return `${color}${"█".repeat(filled)}${C.dim}${"░".repeat(empty)}${C.reset}`;
}

function fmt(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return String(n);
}

function fmtHours(h: number | null): string {
	if (h === null) return "n/a";
	if (h < 1) return `${Math.round(h * 60)}m`;
	if (h < 24) return `${Math.round(h)}h`;
	const days = Math.floor(h / 24);
	const hrs = Math.round(h % 24);
	return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
}

function pct(n: number): string {
	return `${Math.round(n * 100)}%`;
}

function pad(s: string, len: number): string {
	const stripped = s.replace(/\x1b\[[0-9;]*m/g, "");
	return s + " ".repeat(Math.max(0, len - stripped.length));
}

// ── Formatters ──────────────────────────────────────────────────────────────

function printAnalyze(data: AnalyzeRepoResult): void {
	const { repo: r, verdict: v, metrics: m } = data;

	// Header
	process.stdout.write("\n");
	process.stdout.write(`  ${C.bold}${r.fullName}${C.reset}`);
	process.stdout.write(
		`  ${C.dim}${r.language ?? ""} · ${r.license ?? "no license"} · ${fmt(r.stars)} ★ · ${fmt(r.forks)} forks${C.reset}\n`,
	);

	// Verdict badge
	process.stdout.write("\n");
	process.stdout.write(`  ${verdictBg(v.verdict)}${C.bold} ${v.verdict.toUpperCase()} ${C.reset}`);
	process.stdout.write(`  ${C.bold}${v.score}${C.reset}/100\n`);

	// Metric breakdown
	process.stdout.write("\n");
	process.stdout.write(`  ${C.dim}${"─".repeat(56)}${C.reset}\n`);
	for (const b of v.breakdown) {
		const bar = scoreBar(b.score, 15);
		process.stdout.write(
			`  ${pad(b.metric, 22)} ${bar} ${pad(String(b.score), 4)} ${C.dim}(${b.weight}%)${C.reset}\n`,
		);
	}
	process.stdout.write(`  ${C.dim}${"─".repeat(56)}${C.reset}\n`);

	// Key stats
	process.stdout.write("\n");
	const trend = m.activityTrend;
	const trendArrow = trend.trend === "growing" ? "↑" : trend.trend === "declining" ? "↓" : "→";
	const trendColor =
		trend.trend === "growing" ? C.green : trend.trend === "declining" ? C.red : C.yellow;
	process.stdout.write(
		`  ${C.bold}Activity${C.reset}  ${trendColor}${trendArrow} ${trend.trend}${C.reset} (${trend.recentCommits} commits last 3mo)\n`,
	);

	const bf = m.busFactor;
	const bfWarn = bf.isHighRisk ? ` ${C.red}⚠ high risk${C.reset}` : "";
	process.stdout.write(
		`  ${C.bold}Bus Factor${C.reset}  top-2 own ${pct(bf.top2Share)} of commits${bfWarn}\n`,
	);

	const pr = m.prHealth;
	process.stdout.write(
		`  ${C.bold}PR Health${C.reset}  ${pct(pr.mergeRate)} merge rate · ${fmtHours(pr.medianTimeToMergeHours)} median merge\n`,
	);

	const iss = m.issueHealth;
	process.stdout.write(
		`  ${C.bold}Issues${C.reset}  ${pct(iss.closeRate)} close rate · ${fmtHours(iss.medianResponseTimeHours)} median response\n`,
	);

	const rel = m.releaseCadence;
	const relInterval = rel.averageIntervalDays
		? `${Math.round(rel.averageIntervalDays)}d avg`
		: "no releases";
	process.stdout.write(`  ${C.bold}Releases${C.reset}  ${relInterval} · ${rel.label}\n`);

	// Security
	if (m.security) {
		process.stdout.write(
			`  ${C.bold}Security${C.reset}  ${m.security.overallScore}/100 via OpenSSF Scorecard\n`,
		);
	}

	// Corporate backing
	const topOrgs = m.affiliation.orgShares
		.filter((o) => o.organization !== "Independent")
		.slice(0, 5);
	if (topOrgs.length > 0) {
		const orgList = topOrgs.map((o) => o.organization).join(", ");
		process.stdout.write(`  ${C.bold}Backed by${C.reset}  ${orgList}\n`);
	}

	// Enrichment
	if (data.enrichmentSources.length > 0) {
		process.stdout.write(
			`\n  ${C.dim}Enriched by: ${data.enrichmentSources.join(", ")}${C.reset}\n`,
		);
	}

	process.stdout.write("\n");
}

function printContribute(data: ShouldContributeResult): void {
	process.stdout.write("\n");
	process.stdout.write(
		`  ${C.bold}${data.repo}${C.reset}  ${C.dim}Contributor Experience${C.reset}\n`,
	);

	// PR funnel
	process.stdout.write("\n");
	const prLabel =
		data.prHealth.label === "healthy"
			? C.green
			: data.prHealth.label === "moderate"
				? C.yellow
				: C.red;
	process.stdout.write(
		`  ${C.bold}PR Merge Rate${C.reset}   ${prLabel}${pct(data.prHealth.mergeRate)}${C.reset}  ${C.dim}(${data.prHealth.label})${C.reset}\n`,
	);
	process.stdout.write(
		`  ${C.bold}Merge Time${C.reset}      ${fmtHours(data.prHealth.medianTimeToMergeHours)} median\n`,
	);

	if (data.prHealth.medianTimeToFirstReviewHours !== null) {
		process.stdout.write(
			`  ${C.bold}First Review${C.reset}    ${fmtHours(data.prHealth.medianTimeToFirstReviewHours)} median\n`,
		);
	}

	// Issue health
	process.stdout.write("\n");
	process.stdout.write(
		`  ${C.bold}Issue Close Rate${C.reset}  ${pct(data.issueHealth.closeRate)}\n`,
	);
	process.stdout.write(
		`  ${C.bold}Response Time${C.reset}     ${fmtHours(data.issueHealth.medianResponseTimeHours)} median\n`,
	);

	// Good first issues
	process.stdout.write("\n");
	const gfiColor = data.goodFirstIssueCount > 0 ? C.green : C.yellow;
	process.stdout.write(
		`  ${C.bold}Good First Issues${C.reset}  ${gfiColor}${data.goodFirstIssueCount}${C.reset} open\n`,
	);

	// Retention
	const ret = data.contributorRetention;
	process.stdout.write(
		`  ${C.bold}Retention${C.reset}         ${ret.repeatContributors}/${ret.totalContributors} contributors return (${pct(ret.retentionRate)})\n`,
	);

	// Maintainers
	process.stdout.write("\n");
	process.stdout.write(`  ${C.dim}Top Maintainers${C.reset}\n`);
	for (const m of data.topMaintainers.slice(0, 5)) {
		const org = m.organization !== "Independent" ? ` ${C.dim}(${m.organization})${C.reset}` : "";
		process.stdout.write(
			`    ${C.bold}${m.login}${C.reset}  ${fmt(m.contributions)} commits${org}\n`,
		);
	}

	process.stdout.write("\n");
}

function printCompare(data: CompareReposResult): void {
	process.stdout.write("\n");
	const repoNames = data.repos.map((r) => r.repo.fullName);
	process.stdout.write(`  ${C.bold}Comparing: ${repoNames.join(" vs ")}${C.reset}\n`);
	process.stdout.write("\n");

	// Header row
	const colWidth = 14;
	process.stdout.write(`  ${pad("Metric", 22)}`);
	for (const name of repoNames) {
		process.stdout.write(pad(name.split("/")[1] ?? name, colWidth));
	}
	process.stdout.write("Winner\n");

	process.stdout.write(
		`  ${C.dim}${"─".repeat(22 + colWidth * repoNames.length + 10)}${C.reset}\n`,
	);

	for (const row of data.comparison) {
		process.stdout.write(`  ${pad(row.metric, 22)}`);
		for (const val of row.values) {
			const isWinner = val.repo === row.winner;
			const color = isWinner ? C.green + C.bold : C.dim;
			process.stdout.write(`${color}${pad(String(val.value), colWidth)}${C.reset}`);
		}
		const winnerShort = row.winner.split("/")[1] ?? row.winner;
		process.stdout.write(`${C.green}${winnerShort}${C.reset}\n`);
	}

	process.stdout.write(
		`  ${C.dim}${"─".repeat(22 + colWidth * repoNames.length + 10)}${C.reset}\n`,
	);

	// Verdicts
	process.stdout.write("\n");
	for (const r of data.repos) {
		const vc = verdictColor(r.verdict.verdict);
		process.stdout.write(
			`  ${C.bold}${r.repo.fullName}${C.reset}  ${vc}${r.verdict.verdict}${C.reset} (${r.verdict.score}/100)\n`,
		);
	}

	process.stdout.write(`\n  ${C.bold}→${C.reset} ${data.recommendation}\n\n`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];
	const jsonMode = args.includes("--json");
	const fixtureIdx = args.indexOf("--fixture");
	const fixturePath = fixtureIdx >= 0 ? args[fixtureIdx + 1] : undefined;

	if (!command || !["analyze", "contribute", "compare"].includes(command)) {
		process.stderr.write("Usage: npx tsx demo/run-tool.ts <analyze|contribute|compare> ...\n");
		process.exit(1);
	}

	let cache: CacheStore | undefined;
	let github: GitHubClient | undefined;

	if (!fixturePath) {
		const token = process.env.GITHUB_TOKEN;
		if (!token) {
			process.stderr.write("Error: GITHUB_TOKEN required (set in .env or environment)\n");
			process.exit(1);
		}
		cache = new CacheStore();
		github = new GitHubClient(token, cache);
	}

	try {
		if (command === "analyze") {
			const owner = args[1];
			const repo = args[2];
			if (!owner || !repo) {
				process.stderr.write("Usage: npx tsx demo/run-tool.ts analyze <owner> <repo>\n");
				process.exit(1);
			}

			let result: AnalyzeRepoResult;
			if (fixturePath) {
				result = JSON.parse(readFileSync(fixturePath, "utf-8")) as AnalyzeRepoResult;
			} else {
				result = await handleAnalyzeRepo(owner, repo, github!, cache!);
			}

			if (jsonMode) {
				process.stdout.write(JSON.stringify(result, null, 2));
			} else {
				printAnalyze(result);
			}
		} else if (command === "contribute") {
			const owner = args[1];
			const repo = args[2];
			if (!owner || !repo) {
				process.stderr.write("Usage: npx tsx demo/run-tool.ts contribute <owner> <repo>\n");
				process.exit(1);
			}

			let result: ShouldContributeResult;
			if (fixturePath) {
				result = JSON.parse(readFileSync(fixturePath, "utf-8")) as ShouldContributeResult;
			} else {
				result = await handleShouldContribute(owner, repo, github!, cache!);
			}

			if (jsonMode) {
				process.stdout.write(JSON.stringify(result, null, 2));
			} else {
				printContribute(result);
			}
		} else if (command === "compare") {
			const repoArgs = args.slice(1).filter((a, i, arr) => {
				if (a.startsWith("--")) return false;
				if (i > 0 && arr[i - 1] === "--fixture") return false;
				return true;
			});
			if (repoArgs.length < 2) {
				process.stderr.write("Usage: npx tsx demo/run-tool.ts compare owner/repo owner/repo\n");
				process.exit(1);
			}
			const repos = repoArgs.map((r) => {
				const [owner, repo] = r.split("/");
				if (!owner || !repo) {
					process.stderr.write(`Invalid repo format: ${r}. Use owner/repo\n`);
					process.exit(1);
				}
				return { owner, repo };
			});

			let result: CompareReposResult;
			if (fixturePath) {
				result = JSON.parse(readFileSync(fixturePath, "utf-8")) as CompareReposResult;
			} else {
				result = await handleCompareRepos(repos, github!, cache!);
			}

			if (jsonMode) {
				process.stdout.write(JSON.stringify(result, null, 2));
			} else {
				printCompare(result);
			}
		}
	} finally {
		cache?.close();
	}
}

main().catch((err) => {
	process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
	process.exit(1);
});
