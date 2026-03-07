#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_TOOL="$SCRIPT_DIR/run-tool.ts"
FAST_MODE=false
REPLAY_MODE=false
QUICK_MODE=false

for arg in "$@"; do
  case "$arg" in
    --fast) FAST_MODE=true ;;
    --replay) REPLAY_MODE=true; FAST_MODE=true ;;
    --quick) QUICK_MODE=true; REPLAY_MODE=true; FAST_MODE=true ;;
  esac
done

# Load .env if present
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

# ── ANSI helpers ─────────────────────────────────────────────────────────────

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

type_cmd() {
  printf "${GREEN}\$ ${RESET}"
  if [[ "$FAST_MODE" == true ]]; then
    printf "${BOLD}%s${RESET}\n" "$1"
  else
    local cmd="$1"
    for ((i=0; i<${#cmd}; i++)); do
      printf "${BOLD}%s${RESET}" "${cmd:$i:1}"
      sleep 0.03
    done
    echo ""
  fi
}

section() {
  local title="$1"
  local len=${#title}
  echo ""
  printf "${CYAN}╔═"; printf '═%.0s' $(seq 1 "$len"); printf "═╗${RESET}\n"
  printf "${CYAN}║ ${BOLD}%s${RESET}${CYAN} ║${RESET}\n" "$title"
  printf "${CYAN}╚═"; printf '═%.0s' $(seq 1 "$len"); printf "═╝${RESET}\n"
}

commentary() {
  echo ""
  for line in "$@"; do
    printf "  ${DIM}%s${RESET}\n" "$line"
  done
}

pause() {
  if [[ "$QUICK_MODE" == true ]]; then
    sleep 3
  elif [[ "$FAST_MODE" == true ]]; then
    sleep 1
  else
    printf "\n${DIM}  press enter to continue...${RESET}"
    read -r
  fi
  printf '\033[2J\033[H'
}

run_tool() {
  local cmd="$1"
  shift
  if [[ "$REPLAY_MODE" == true ]]; then
    npx tsx "$RUN_TOOL" "$cmd" "$@"
  else
    npx tsx "$RUN_TOOL" "$cmd" "$@"
  fi
}

fixture_flag() {
  if [[ "$REPLAY_MODE" == true ]]; then
    echo "--fixture"
  else
    echo ""
  fi
}

# ── Acts ─────────────────────────────────────────────────────────────────────

act_opening() {
  printf '\033[2J\033[H'
  echo ""
  printf "${CYAN}${BOLD}"
  echo "   ╔═╗╔═╗╔═╗  ╦╔╗╔╔╦╗╔═╗╦  "
  echo "   ║ ║╚═╗╚═╗  ║║║║ ║ ║╣ ║  "
  echo "   ╚═╝╚═╝╚═╝  ╩╝╚╝ ╩ ╚═╝╩═╝"
  printf "${RESET}"
  printf "  ${DIM}AI-native open-source intelligence${RESET}\n"
  echo ""

  commentary \
    "OSS Intel analyzes GitHub repositories and tells you:" \
    "  • Should I use this dependency?" \
    "  • Should I contribute to this project?" \
    "  • Which library is healthier?" \
    "" \
    "Data from GitHub API + OpenSSF Scorecard + OSS Insight."

  echo ""
  bash "$SCRIPT_DIR/setup-fixture.sh" "$REPLAY_MODE"
  pause
}

act_analyze() {
  section "Act 1: Should I Use This?"

  commentary \
    "analyze_repo produces a comprehensive health report:" \
    "verdict, 8 metrics, security score, corporate backing."

  if [[ "$QUICK_MODE" != true ]]; then
    pause
  else
    sleep 1
  fi

  type_cmd "oss-intel analyze_repo expressjs/express"
  echo ""

  if [[ "$REPLAY_MODE" == true ]]; then
    run_tool analyze expressjs express --fixture "$REPO_ROOT/demo/fixtures/analyze-express.json"
  else
    run_tool analyze expressjs express
  fi

  pause
}

act_contribute() {
  section "Act 2: Should I Contribute?"

  commentary \
    "should_i_contribute shows the contributor experience:" \
    "PR merge rates, review times, good first issues, retention."

  if [[ "$QUICK_MODE" != true ]]; then
    pause
  else
    sleep 1
  fi

  type_cmd "oss-intel should_i_contribute expressjs/express"
  echo ""

  if [[ "$REPLAY_MODE" == true ]]; then
    run_tool contribute expressjs express --fixture "$REPO_ROOT/demo/fixtures/contribute-express.json"
  else
    run_tool contribute expressjs express
  fi

  pause
}

act_compare() {
  section "Act 3: Compare Repos"

  commentary \
    "compare_repos runs side-by-side analysis of 2-3 repos." \
    "Per-metric winners and an overall recommendation."

  if [[ "$QUICK_MODE" != true ]]; then
    pause
  else
    sleep 1
  fi

  type_cmd "oss-intel compare_repos express vs fastify"
  echo ""

  if [[ "$REPLAY_MODE" == true ]]; then
    run_tool compare expressjs/express fastify/fastify --fixture "$REPO_ROOT/demo/fixtures/compare-express-fastify.json"
  else
    run_tool compare expressjs/express fastify/fastify
  fi

  pause
}

act_closing() {
  echo ""
  printf "${CYAN}${BOLD}"
  echo "  ╔════════════════════════════════════════╗"
  echo "  ║                                        ║"
  echo "  ║   Should I use it?   oss-intel knows.  ║"
  echo "  ║   Should I contrib?  oss-intel knows.  ║"
  echo "  ║   Which is better?   oss-intel knows.  ║"
  echo "  ║                                        ║"
  echo "  ╚════════════════════════════════════════╝"
  printf "${RESET}\n"
  printf "  ${DIM}github.com/jonzarecki/oss-intel-mcp${RESET}\n"
  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  act_opening
  act_analyze
  act_contribute
  act_compare
  act_closing
}

main "$@"
