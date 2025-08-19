#!/usr/bin/env bash
set -euo pipefail

# Usage: ./tests/load/scripts/run-http-call-constant-arrival.sh [BASE_URL] [RATE] [DURATION] [PRE_VUS] [MAX_VUS] [SLEEP_MS]
BASE_URL=${1:-http://localhost:3000}
RATE=${2:-1000}
DURATION=${3:-30s}
PRE_VUS=${4:-200}
MAX_VUS=${5:-1000}
SLEEP_MS=${6:-0}

echo "Running k6 HTTP call-only constant arrival against ${BASE_URL} at ${RATE} rps for ${DURATION}..."
BASE_URL="$BASE_URL" RATE="$RATE" DURATION="$DURATION" VUS="$PRE_VUS" MAX_VUS="$MAX_VUS" SLEEP_MS="$SLEEP_MS" SELECTED_SCENARIO=constant_arrival k6 run tests/load/k6-http-call-only.js


