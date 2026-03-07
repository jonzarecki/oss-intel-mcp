import "dotenv/config";
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CacheStore } from "./cache/store.js";
import { GitHubClient } from "./github/client.js";
import { log } from "./logger.js";
import { registerTools } from "./tools/register.js";

const token = process.env.GITHUB_TOKEN;
if (!token) {
	log.error("GITHUB_TOKEN environment variable is required", {
		help: "Create a token at https://github.com/settings/tokens (scope: public_repo)",
	});
	process.exit(1);
}

const PORT = Number.parseInt(process.env.PORT ?? "9847", 10);
const USE_STDIO = process.argv.includes("--stdio");

const cache = new CacheStore();
const github = new GitHubClient(token, cache);

if (USE_STDIO) {
	const server = new McpServer({ name: "oss-intel", version: "0.1.0" });
	registerTools(server, github, cache);

	const transport = new StdioServerTransport();
	await server.connect(transport);
} else {
	const httpServer = createServer(async (req, res) => {
		if (req.method === "GET" && req.url === "/health") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "ok", version: "0.1.0" }));
			return;
		}

		const server = new McpServer({ name: "oss-intel", version: "0.1.0" });
		registerTools(server, github, cache);

		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});
		await server.connect(transport);
		await transport.handleRequest(req, res);
	});

	httpServer.listen(PORT, () => {
		log.info("MCP server listening", {
			transport: "http",
			port: PORT,
			url: `http://localhost:${PORT}/mcp`,
		});
	});
}

process.on("SIGINT", () => {
	cache.close();
	process.exit(0);
});
