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

const repoData = await github.getRepo("kagenti", "kagenti");
process.stdout.write(`GitHub open_issues_count (includes PRs): ${repoData.open_issues_count}\n`);
process.stdout.write(`Our openIssues (issue-only): ${r.repo.openIssues}\n`);
process.stdout.write(`Issue close rate: ${r.metrics.issueHealth.closeRate}\n`);
process.stdout.write(`Issue health score: ${r.metrics.issueHealth.score}\n`);
process.stdout.write(`Issue health label: ${r.metrics.issueHealth.label}\n`);

const diff = repoData.open_issues_count - r.repo.openIssues;
if (diff > 0) {
	process.stdout.write(`\n✓ Fixed: excluded ${diff} open PRs from issue count\n`);
} else {
	process.stdout.write("\n(no difference — repo may have 0 open PRs)\n");
}

cache.close();
