#!/usr/bin/env bash
set -euo pipefail

# Checks prerequisites for the demo.
# Called by demo.sh before running acts.
# Exits non-zero if anything is missing.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPLAY_MODE="${1:-false}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RESET='\033[0m'

missing=0

if ! command -v node &>/dev/null; then
  printf "  ${RED}✗ node not found.${RESET} Install Node.js >= 22\n"
  missing=1
fi

if ! command -v npx &>/dev/null; then
  printf "  ${RED}✗ npx not found.${RESET} Install Node.js >= 22\n"
  missing=1
fi

if [[ ! -f "$REPO_ROOT/node_modules/.pnpm/lock.yaml" ]] && [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  printf "  ${YELLOW}⚠ node_modules not found.${RESET} Run: pnpm install\n"
  missing=1
fi

if [[ "$REPLAY_MODE" != "true" ]]; then
  # Need GITHUB_TOKEN for live mode
  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    # Try loading from .env
    if [[ -f "$REPO_ROOT/.env" ]]; then
      GITHUB_TOKEN=$(grep -E '^GITHUB_TOKEN=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '[:space:]')
      export GITHUB_TOKEN
    fi
  fi

  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    printf "  ${RED}✗ GITHUB_TOKEN not set.${RESET} Add to .env or export it\n"
    missing=1
  fi
else
  # Verify fixtures exist for replay
  for f in analyze-express.json contribute-express.json compare-express-fastify.json; do
    if [[ ! -f "$REPO_ROOT/demo/fixtures/$f" ]]; then
      printf "  ${RED}✗ Missing fixture: demo/fixtures/$f${RESET}\n"
      missing=1
    fi
  done
fi

if [[ $missing -eq 1 ]]; then
  echo ""
  echo "  Fix the above and re-run."
  exit 1
fi

printf "  ${GREEN}✓ All prerequisites met.${RESET}\n"
