#!/usr/bin/env bash
set -euo pipefail

# Usage: ./tests/load/scripts/run-http-sse.sh [BASE_URL] [VUS] [DURATION]
BASE_URL=${1:-http://localhost:3000}
VUS=${2:-20}
DURATION=${3:-30s}

echo "Running k6 HTTP SSE scenario against ${BASE_URL} with ${VUS} VUs for ${DURATION}..."
BASE_URL="$BASE_URL" VUS="$VUS" DURATION="$DURATION" k6 run tests/load/k6-http-rpc.js


