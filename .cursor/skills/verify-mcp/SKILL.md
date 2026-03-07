# Verify MCP Server Skill

Verify the MCP server starts correctly and tools are registered.

## Trigger
Use when the user says "check if it works", "verify the server", or after making changes to tool registration or server entry point.

## Process

### 1. Check TypeScript compiles
```bash
cd /Users/jzarecki/Projects/oss-intel-mcp
pnpm typecheck
```

### 2. Check lint passes
```bash
pnpm lint
```

### 3. Verify MCP server starts (once implemented)
```bash
# The MCP server communicates over stdio; test with a simple init message
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | node dist/index.js 2>/dev/null
```

### 4. Check tool registration
Look at `src/index.ts` and verify all 3 tools are registered:
- `analyze_repo`
- `should_i_contribute`
- `compare_repos`

## After verifying
- Report which checks passed/failed
- If the server fails to start, check for missing dependencies or config
- If tools are missing, check `src/index.ts` registration
