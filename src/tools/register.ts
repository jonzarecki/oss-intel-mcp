import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	RESOURCE_MIME_TYPE,
	registerAppResource,
	registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { CacheStore } from "../cache/store.js";
import type { GitHubClient } from "../github/client.js";
import { handleAnalyzeRepo } from "./analyze-repo.js";
import { handleCompareRepos } from "./compare-repos.js";
import { handleShouldContribute } from "./should-contribute.js";

import { existsSync } from "node:fs";

// In bundled mode (dist/index.js), panels are at dist/ui/panels.
// In dev mode (tsx src/tools/register.ts), panels are at src/ui/panels.
const bundledPath = join(import.meta.dirname, "ui", "panels");
const devPath = join(import.meta.dirname, "..", "ui", "panels");
const PANELS_DIR = existsSync(bundledPath) ? bundledPath : devPath;

export function registerTools(server: McpServer, github: GitHubClient, cache: CacheStore): void {
	// --- analyze_repo → verdict card ---
	const verdictUri = "ui://oss-intel/verdict.html";

	registerAppTool(
		server,
		"analyze_repo",
		{
			title: "Analyze Repository",
			description:
				"Comprehensive health analysis of a GitHub repository. Returns verdict (Safe/Caution/Risky), activity trends, bus factor, PR health, issue responsiveness, release cadence, corporate backing, and security score.",
			inputSchema: {
				owner: z.string().describe("GitHub org or user (e.g. 'facebook')"),
				repo: z.string().describe("Repository name (e.g. 'react')"),
			},
			_meta: { ui: { resourceUri: verdictUri } },
		},
		async ({ owner, repo }) => {
			const result = await handleAnalyzeRepo(owner, repo, github, cache);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				structuredContent: result as unknown as Record<string, unknown>,
			};
		},
	);

	registerAppResource(
		server,
		"Verdict",
		verdictUri,
		{ description: "Overall health verdict with score breakdown" },
		async () => {
			const html = await loadPanel("verdict.html");
			return { contents: [{ uri: verdictUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
		},
	);

	// --- should_i_contribute → responsiveness card ---
	const responsivenessUri = "ui://oss-intel/responsiveness.html";

	registerAppTool(
		server,
		"should_i_contribute",
		{
			title: "Should I Contribute?",
			description:
				"Contributor-focused analysis. Shows PR merge rates, review times, maintainer responsiveness, good first issues, and contributor retention.",
			inputSchema: {
				owner: z.string().describe("GitHub org or user"),
				repo: z.string().describe("Repository name"),
			},
			_meta: { ui: { resourceUri: responsivenessUri } },
		},
		async ({ owner, repo }) => {
			const result = await handleShouldContribute(owner, repo, github, cache);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				structuredContent: result as unknown as Record<string, unknown>,
			};
		},
	);

	registerAppResource(
		server,
		"Responsiveness",
		responsivenessUri,
		{ description: "PR merge rates, review time, and issue responsiveness" },
		async () => {
			const html = await loadPanel("responsiveness.html");
			return { contents: [{ uri: responsivenessUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
		},
	);

	// --- compare_repos → comparison table ---
	const comparisonUri = "ui://oss-intel/comparison.html";

	registerAppTool(
		server,
		"compare_repos",
		{
			title: "Compare Repositories",
			description:
				"Side-by-side comparison of 2-3 repositories on all health metrics. Shows per-metric winners and an overall recommendation.",
			inputSchema: {
				repos: z
					.array(
						z.object({
							owner: z.string().describe("GitHub org or user"),
							repo: z.string().describe("Repository name"),
						}),
					)
					.min(2)
					.max(3)
					.describe("Array of 2-3 repo identifiers to compare"),
			},
			_meta: { ui: { resourceUri: comparisonUri } },
		},
		async ({ repos }) => {
			const result = await handleCompareRepos(repos, github, cache);
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				structuredContent: result as unknown as Record<string, unknown>,
			};
		},
	);

	registerAppResource(
		server,
		"Comparison",
		comparisonUri,
		{ description: "Side-by-side repository metric comparison" },
		async () => {
			const html = await loadPanel("comparison.html");
			return { contents: [{ uri: comparisonUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
		},
	);

	// --- Focused standalone panels (receive analyze_repo data) ---
	const activityUri = "ui://oss-intel/activity-pulse.html";
	registerAppResource(
		server,
		"Activity Pulse",
		activityUri,
		{ description: "Commit activity trend and release cadence" },
		async () => {
			const html = await loadPanel("activity-pulse.html");
			return { contents: [{ uri: activityUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
		},
	);

	const busFactorUri = "ui://oss-intel/bus-factor.html";
	registerAppResource(
		server,
		"Bus Factor",
		busFactorUri,
		{ description: "Contributor concentration risk analysis" },
		async () => {
			const html = await loadPanel("bus-factor.html");
			return { contents: [{ uri: busFactorUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
		},
	);

	const corpBackingUri = "ui://oss-intel/corporate-backing.html";
	registerAppResource(
		server,
		"Corporate Backing",
		corpBackingUri,
		{ description: "Elephant factor and organization affiliation breakdown" },
		async () => {
			const html = await loadPanel("corporate-backing.html");
			return { contents: [{ uri: corpBackingUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
		},
	);

	const securityUri = "ui://oss-intel/security.html";
	registerAppResource(
		server,
		"Security",
		securityUri,
		{ description: "OpenSSF Scorecard security assessment" },
		async () => {
			const html = await loadPanel("security.html");
			return { contents: [{ uri: securityUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
		},
	);
}

async function loadPanel(filename: string): Promise<string> {
	return readFile(join(PANELS_DIR, filename), "utf-8");
}
