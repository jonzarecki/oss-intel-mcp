import { type ChildProcess, spawn } from "node:child_process";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";

const HAS_TOKEN = Boolean(process.env.GITHUB_TOKEN);
const SERVER_PATH = join(import.meta.dirname, "..", "..", "dist", "index.js");
const TEST_PORT = 19847;
const SERVER_URL = `http://localhost:${TEST_PORT}/mcp`;

describe.skipIf(!HAS_TOKEN)("E2E: MCP Server over HTTP", () => {
	let client: Client;
	let serverProc: ChildProcess;

	beforeAll(async () => {
		serverProc = spawn("node", [SERVER_PATH], {
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env, PORT: String(TEST_PORT) },
		});

		await waitForServer(SERVER_URL, 10_000);

		const transport = new StreamableHTTPClientTransport(new URL(SERVER_URL));
		client = new Client({ name: "e2e-test", version: "1.0.0" });
		await client.connect(transport);
	}, 20_000);

	afterAll(async () => {
		try {
			await client?.close();
		} catch {
			// ignore cleanup errors
		}
		serverProc?.kill();
	});

	it("lists 3 registered tools", async () => {
		const { tools } = await client.listTools();
		const names = tools.map((t) => t.name).sort();
		expect(names).toEqual(["analyze_repo", "compare_repos", "should_i_contribute"]);
	}, 10_000);

	it("analyze_repo returns valid health report for expressjs/express", async () => {
		const result = await client.callTool({
			name: "analyze_repo",
			arguments: { owner: "expressjs", repo: "express" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		expect(content.length).toBeGreaterThan(0);

		const textContent = content.find((c) => c.type === "text");
		expect(textContent).toBeDefined();

		const data = JSON.parse(textContent!.text) as Record<string, unknown>;

		const repo = data.repo as Record<string, unknown>;
		expect(repo.fullName).toBe("expressjs/express");
		expect(repo.stars).toBeGreaterThan(0);
		expect(repo.language).toBeTruthy();

		const verdict = data.verdict as Record<string, unknown>;
		expect(["Safe to adopt", "Use with caution", "Risky"]).toContain(verdict.verdict);
		expect(verdict.score).toBeGreaterThanOrEqual(0);
		expect(verdict.score).toBeLessThanOrEqual(100);
		expect(Array.isArray(verdict.breakdown)).toBe(true);

		const metrics = data.metrics as Record<string, unknown>;
		expect(metrics.busFactor).toBeDefined();
		expect(metrics.activityTrend).toBeDefined();
		expect(metrics.prHealth).toBeDefined();
		expect(metrics.issueHealth).toBeDefined();
		expect(metrics.releaseCadence).toBeDefined();
		expect(metrics.affiliation).toBeDefined();

		expect(Array.isArray(data.enrichmentSources)).toBe(true);
	}, 120_000);

	it("should_i_contribute returns contributor analysis", async () => {
		const result = await client.callTool({
			name: "should_i_contribute",
			arguments: { owner: "expressjs", repo: "express" },
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const textContent = content.find((c) => c.type === "text");
		expect(textContent).toBeDefined();

		const data = JSON.parse(textContent!.text) as Record<string, unknown>;

		expect(data.repo).toBe("expressjs/express");

		const prHealth = data.prHealth as Record<string, unknown>;
		expect(prHealth.mergeRate).toBeGreaterThanOrEqual(0);

		expect(typeof data.goodFirstIssueCount).toBe("number");

		const retention = data.contributorRetention as Record<string, unknown>;
		expect(retention.totalContributors).toBeGreaterThan(0);

		expect(Array.isArray(data.topMaintainers)).toBe(true);
		expect((data.topMaintainers as unknown[]).length).toBeGreaterThan(0);
	}, 120_000);

	it("compare_repos returns side-by-side comparison", async () => {
		const result = await client.callTool({
			name: "compare_repos",
			arguments: {
				repos: [
					{ owner: "expressjs", repo: "express" },
					{ owner: "fastify", repo: "fastify" },
				],
			},
		});

		expect(result.isError).toBeFalsy();
		const content = result.content as Array<{ type: string; text: string }>;
		const textContent = content.find((c) => c.type === "text");
		expect(textContent).toBeDefined();

		const data = JSON.parse(textContent!.text) as Record<string, unknown>;

		const repos = data.repos as unknown[];
		expect(repos).toHaveLength(2);

		const comparison = data.comparison as unknown[];
		expect(comparison.length).toBeGreaterThan(0);

		expect(typeof data.recommendation).toBe("string");
		expect((data.recommendation as string).length).toBeGreaterThan(0);
	}, 180_000);
});

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
	const start = Date.now();
	const baseUrl = url.replace("/mcp", "");
	while (Date.now() - start < timeoutMs) {
		try {
			await fetch(baseUrl);
			return;
		} catch {
			await new Promise((r) => setTimeout(r, 200));
		}
	}
	throw new Error(`Server did not start within ${timeoutMs}ms`);
}
