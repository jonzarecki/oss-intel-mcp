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

const r = await handleAnalyzeRepo("kagenti", "kagenti", github, cache);

const sec = r.metrics.security;
if (sec) {
	process.stdout.write(`Security score: ${sec.score}/100\n`);
	process.stdout.write(`Review depth: ${JSON.stringify(sec.reviewDepth, null, 2)}\n`);
	const cr = sec.subScores.find((s) => s.name === "Code Review");
	if (cr) {
		process.stdout.write(`Code Review sub-score: ${cr.score}/10 — ${cr.reason}\n`);
	}
} else {
	process.stdout.write("No security data available\n");
}

cache.close();
