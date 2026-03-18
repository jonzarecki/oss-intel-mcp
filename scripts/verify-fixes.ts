import { CacheStore } from "../src/cache/store.js";
import { GitHubClient } from "../src/github/client.js";
import { handleAnalyzeRepo } from "../src/tools/analyze-repo.js";

const token = process.env.GITHUB_TOKEN;
if (!token) {
	process.stderr.write("GITHUB_TOKEN required\n");
	process.exit(1);
}

const cache = new CacheStore();
const github = new GitHubClient(token, cache);

interface RepoTest {
	owner: string;
	repo: string;
	issues: string[];
	checks: (result: Awaited<ReturnType<typeof handleAnalyzeRepo>>) => string[];
}

const tests: RepoTest[] = [
	{
		owner: "exo-explore",
		repo: "exo",
		issues: ["#1 — affiliation detection"],
		checks: (r) => {
			const fails: string[] = [];
			const alex = r.metrics.affiliation.topContributors.find(
				(c) => c.login.toLowerCase() === "alexcheema",
			);
			if (alex) {
				process.stdout.write(`  AlexCheema → ${alex.organization}`);
				if (alex.organization.toLowerCase().includes("oxford")) {
					process.stdout.write(
						" (private org membership + no bio — no override signal available)\n",
					);
				} else {
					process.stdout.write("\n");
				}
			}

			const jake = r.metrics.affiliation.topContributors.find(
				(c) => c.login.toLowerCase() === "jakehillion",
			);
			if (jake && jake.organization === "Hillion") {
				fails.push(`JakeHillion still shows "Hillion" (personal domain bug)`);
			}
			if (jake) {
				process.stdout.write(`  JakeHillion → ${jake.organization}\n`);
			}

			const matt = r.metrics.affiliation.topContributors.find(
				(c) => c.login.toLowerCase() === "mattbeton",
			);
			if (matt && matt.organization.toLowerCase().includes("cambridge")) {
				fails.push(
					`MattBeton still shows "${matt.organization}" (should be repo org, not university)`,
				);
			}
			if (matt) {
				process.stdout.write(`  MattBeton → ${matt.organization}\n`);
			}

			return fails;
		},
	},
	{
		owner: "kagenti",
		repo: "kagenti",
		issues: ["#3 — activity trend", "#5/#6 — affiliation org membership"],
		checks: (r) => {
			const fails: string[] = [];

			if (r.metrics.activityTrend.recentCommits === 0) {
				fails.push(
					`Activity trend still shows 0 recent commits (score: ${r.metrics.activityTrend.score})`,
				);
			}
			process.stdout.write(
				`  Activity: ${r.metrics.activityTrend.recentCommits} recent commits, trend="${r.metrics.activityTrend.trend}", score=${r.metrics.activityTrend.score}\n`,
			);

			const evaline = r.metrics.affiliation.topContributors.find(
				(c) => c.login === "evaline-ju",
			);
			if (evaline && evaline.organization === "Independent") {
				fails.push(`evaline-ju still "Independent" (should be IBM via org membership)`);
			}
			if (evaline) {
				process.stdout.write(`  evaline-ju → ${evaline.organization}\n`);
			}

			if (r.enrichmentSources.includes("github-commits-fallback")) {
				process.stdout.write("  [used commits API fallback for activity data]\n");
			}

			return fails;
		},
	},
];

let totalFails = 0;

for (const test of tests) {
	process.stdout.write(`\n=== ${test.owner}/${test.repo} (${test.issues.join(", ")}) ===\n`);
	const start = Date.now();
	try {
		const result = await handleAnalyzeRepo(test.owner, test.repo, github, cache);
		const elapsed = ((Date.now() - start) / 1000).toFixed(1);
		process.stdout.write(
			`  Verdict: ${result.verdict.verdict} (${result.verdict.score}/100) [${elapsed}s]\n`,
		);
		process.stdout.write(`  Enrichment: ${result.enrichmentSources.join(", ") || "none"}\n`);

		const affTopOrgs = result.metrics.affiliation.orgShares
			.slice(0, 5)
			.map(
				(s) =>
					`${s.organization} ${Math.round(s.percentage * 100)}%`,
			);
		process.stdout.write(`  Top orgs: ${affTopOrgs.join(", ")}\n`);

		const fails = test.checks(result);
		if (fails.length === 0) {
			process.stdout.write("  ✓ All checks passed\n");
		} else {
			for (const f of fails) {
				process.stdout.write(`  ✗ FAIL: ${f}\n`);
			}
			totalFails += fails.length;
		}
	} catch (err) {
		process.stdout.write(`  ✗ ERROR: ${err}\n`);
		totalFails++;
	}
}

cache.close();
process.stdout.write(`\n${totalFails === 0 ? "All checks passed!" : `${totalFails} check(s) failed.`}\n`);
process.exit(totalFails > 0 ? 1 : 0);
