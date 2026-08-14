#!/usr/bin/env bash
# tests/integration/run.sh
# v1.0.20-rc-final: Deterministic local runner for integration tests.
#
# Mirrors the CI workflow (.github/workflows/ci.yml, job "integration-tests"):
#   1. Push schema to a fresh test DB
#   2. Seed
#   3. Start `next dev -p 3099` as a background process IN THIS SHELL
#   4. Wait until /api/health returns 200 with body.ok === true (not 404)
#   5. Run vitest against tests/integration/
#   6. Kill the server on exit (even on failure)
#
# Why this script exists:
# - Previously, integration tests started the server from a Vitest globalSetup.
#   That approach was flaky: the server logged "Ready" but Node's fetch from
#   inside the test runner could not connect to it (ECONNREFUSED).
# - The deterministic fix is to start the server as a SIBLING process (not a
#   Vitest child), wait for /api/health to be truly ready, then run the tests.
# - This script mirrors exactly what the CI does, so a green run here means a
#   green run in CI.
set -euo pipefail

PORT="${INTEGRATION_PORT:-3099}"
BASE_URL="http://127.0.0.1:${PORT}"
DB_PATH="${INTEGRATION_DB:-./db/test-integration.db}"
LOG_FILE="${INTEGRATION_LOG:-/tmp/softlba-integration-server.log}"
SERVER_PID=""

cleanup() {
  echo ""
  echo "[run.sh] Cleaning up..."
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[run.sh] Killing server PID=$SERVER_PID"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  pkill -f "next dev -p ${PORT}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[run.sh] Step 1/5: Prepare test DB at $DB_PATH"
rm -f "$DB_PATH" "$DB_PATH-journal" "$DB_PATH-wal" "$DB_PATH-shm" 2>/dev/null || true
DATABASE_URL="file:$DB_PATH" bun run db:push > /dev/null 2>&1
DATABASE_URL="file:$DB_PATH" bun run db:seed > /dev/null 2>&1

echo "[run.sh] Step 2/5: Start Next.js dev server on port $PORT"
# Use nohup + setsid so the server survives even if the bash subshell exits
# (CI runners are OK with plain `&`, but local terminals sometimes are not).
nohup npx next dev -p "$PORT" > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "[run.sh] Server PID=$SERVER_PID, log=$LOG_FILE"

echo "[run.sh] Step 3/5: Wait for /api/health to return 200 ok=true (max 120s)"
HEALTHY=0
for i in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[run.sh] ERROR: server process died before becoming healthy"
    echo "=== Last 30 lines of server log ==="
    tail -30 "$LOG_FILE" 2>/dev/null || true
    exit 1
  fi
  RESPONSE=$(curl -s "$BASE_URL/api/health" 2>/dev/null || echo "")
  if [ -n "$RESPONSE" ]; then
    OK=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ok',''))" 2>/dev/null || echo "")
    if [ "$OK" = "True" ]; then
      echo "[run.sh] Server healthy at attempt $i: $RESPONSE"
      HEALTHY=1
      break
    fi
    echo "[run.sh] Attempt $i: response=$RESPONSE"
  else
    echo "[run.sh] Attempt $i: no response (server still starting?)"
  fi
  sleep 2
done

if [ "$HEALTHY" -ne 1 ]; then
  echo "[run.sh] ERROR: Server did not become healthy in 120s"
  echo "=== Last 30 lines of server log ==="
  tail -30 "$LOG_FILE" 2>/dev/null || true
  exit 1
fi

echo "[run.sh] Step 4/5: Run integration tests"
DATABASE_URL="file:$DB_PATH" INTEGRATION_BASE_URL="$BASE_URL" npx vitest run tests/integration/
TEST_EXIT=$?

echo "[run.sh] Step 5/5: Test exit code = $TEST_EXIT"
exit $TEST_EXIT
