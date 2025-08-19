#!/usr/bin/env bash
set -euo pipefail

# Usage: ./tests/load/scripts/run-http-call-constant-vus.sh [BASE_URL] [VUS] [DURATION] [SLEEP_MS]
BASE_URL=${1:-http://localhost:3000}
VUS=${2:-100}
DURATION=${3:-30s}
SLEEP_MS=${4:-0}

echo "Running k6 HTTP call-only constant VUs against ${BASE_URL} with ${VUS} VUs for ${DURATION}..."
BASE_URL="$BASE_URL" VUS="$VUS" DURATION="$DURATION" SLEEP_MS="$SLEEP_MS" SELECTED_SCENARIO=constant_vus k6 run tests/load/k6-http-call-only.js


