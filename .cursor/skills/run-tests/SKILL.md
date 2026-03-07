# Run Tests Skill

Run tests for the OSS Intelligence MCP project.

## Trigger
Use when the user asks to run tests, says "check if tests pass", or after making code changes.

## Process

### Run all tests
```bash
cd /Users/jzarecki/Projects/oss-intel-mcp
pnpm test
```

### Run specific test suites
```bash
# Metric unit tests only
pnpm test tests/metrics/

# Tool integration tests only
pnpm test tests/tools/

# Single file
pnpm test tests/metrics/bus-factor.test.ts
```

### With coverage
```bash
pnpm test --coverage
```

## After running
- Report pass/fail count and any failures
- If tests fail, read the failing test and the source file to diagnose
- Fix failures if they're caused by recent changes
- If tests were already failing before your changes, note this to the user
