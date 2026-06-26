#!/usr/bin/env bash
#
# Smoke test for the live Incident Stories stack.
#
# Hits the 4 most important surfaces:
#   1. Health endpoint           — proves backend is running and reachable
#   2. CORS preflight             — proves ALLOWED_ORIGINS lets the browser through
#   3. Public list (GET)          — proves DB is wired and SQL migrations ran
#                                    (also proves the `summary` rename worked — items
#                                    must have a `summary` field, not `tldr`)
#   4. Public submit (POST)       — proves writes work end-to-end
#
# Usage:
#   RENDER_URL=https://incident-stories-api.onrender.com \
#   VERCEL_ORIGIN=https://incident-stories.vercel.app \
#     ./smoke-test.sh
#
# Exit code: 0 if all 4 pass, 1 otherwise. Each check prints PASS/FAIL on its
# own line so you can grep through the output.

set -uo pipefail

RENDER_URL="${RENDER_URL:-}"
VERCEL_ORIGIN="${VERCEL_ORIGIN:-}"

# Pretty output
GREEN=$'\033[32m'
RED=$'\033[31m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

pass() { printf '%s✓ PASS%s — %s\n' "$GREEN" "$RESET" "$1"; }
fail() { printf '%s✗ FAIL%s — %s\n' "$RED" "$RESET" "$1"; FAILED=1; }
warn() { printf '%s! WARN%s — %s\n' "$YELLOW" "$RESET" "$1"; }

FAILED=0

# --- preflight: required env ---
echo "==> Smoke test starting"
echo "    RENDER_URL    = ${RENDER_URL:-<not set>}"
echo "    VERCEL_ORIGIN = ${VERCEL_ORIGIN:-<not set>}"
echo

if [ -z "$RENDER_URL" ] || [ -z "$VERCEL_ORIGIN" ]; then
  cat <<EOF
Usage:
  RENDER_URL=https://incident-stories-api.onrender.com \\
  VERCEL_ORIGIN=https://incident-stories.vercel.app \\
    $0

Set RENDER_URL to whatever Render gave you (it may have a suffix like -xyz1 if
the name was taken). Set VERCEL_ORIGIN to your Vercel project URL.
EOF
  exit 1
fi

# Strip trailing slash from RENDER_URL (the app is sensitive to it)
RENDER_URL="${RENDER_URL%/}"

# ---------- 1. Health ----------
echo "==> 1/4 Health check"
HEALTH_BODY=$(curl -fsS --max-time 60 "${RENDER_URL}/health" 2>&1) || {
  fail "GET /health did not return 2xx"
  echo "    Body: ${HEALTH_BODY:0:200}"
  warn "First-request cold start on Render free tier can take 30-60s. Re-run if this is the very first call after idle."
  echo
  echo "Skipping remaining checks — backend is unreachable."
  exit 1
}
if echo "$HEALTH_BODY" | grep -q '"status":"ok"'; then
  pass "GET /health → status ok"
  echo "    Body: $HEALTH_BODY"
else
  fail "GET /health body doesn't contain status:ok"
  echo "    Body: $HEALTH_BODY"
fi
echo

# ---------- 2. CORS preflight ----------
echo "==> 2/4 CORS preflight"
CORS_HEADERS=$(curl -fsS --max-time 30 -i -X OPTIONS "${RENDER_URL}/api/incidents" \
  -H "Origin: ${VERCEL_ORIGIN}" \
  -H "Access-Control-Request-Method: GET" 2>&1) || {
  fail "OPTIONS /api/incidents did not return 2xx"
  echo "    Headers: ${CORS_HEADERS:0:300}"
  echo
}

if echo "$CORS_HEADERS" | grep -qi "^access-control-allow-origin: ${VERCEL_ORIGIN}"; then
  pass "OPTIONS /api/incidents — Access-Control-Allow-Origin matches ${VERCEL_ORIGIN}"
elif echo "$CORS_HEADERS" | grep -qi "^access-control-allow-origin: \*"; then
  pass "OPTIONS /api/incidents — wildcard CORS (works for all origins)"
else
  fail "OPTIONS /api/incidents — Access-Control-Allow-Origin header missing or wrong"
  echo "    Expected: ${VERCEL_ORIGIN}"
  echo "    Got headers:"
  echo "$CORS_HEADERS" | grep -i "access-control" || echo "    (no Access-Control-* headers at all)"
  echo "    Fix: Render → service → Environment → ALLOWED_ORIGINS must include ${VERCEL_ORIGIN} (no trailing slash)"
fi
echo

# ---------- 3. Public list ----------
echo "==> 3/4 Public incident list (proves SQL migration + DB wiring)"
LIST=$(curl -fsS --max-time 30 "${RENDER_URL}/api/incidents?page=1&page_size=3" 2>&1) || {
  fail "GET /api/incidents did not return 2xx"
  echo "    Body: ${LIST:0:300}"
  echo
}

# Parse and inspect
if echo "$LIST" | grep -q '"summary"'; then
  pass "GET /api/incidents — items have a summary field (0004 migration ran)"
elif echo "$LIST" | grep -q '"tldr"'; then
  fail "GET /api/incidents — items still have the old 'tldr' field. Migration 0004 didn't run."
  echo "    Fix: Supabase SQL Editor → run deploy/supabase/0004_rename_tldr_to_summary.sql"
elif echo "$LIST" | grep -q '"items":\[\]'; then
  warn "GET /api/incidents returned empty items list. Either the project has no approved stories yet, or there's a DB read issue."
else
  fail "GET /api/incidents — response shape unexpected"
  echo "    Body (first 300 chars): ${LIST:0:300}"
fi
echo

# ---------- 4. Public submit (writes) ----------
echo "==> 4/4 Public submit (proves POST + background AI worker)"
SUBMIT_BODY=$(cat <<EOF
{
  "raw_text": "$(date +%s) smoke test — production deploy verification. The queue worker rejected payment processing for 8 minutes because the cache TTL was set to 0 in a bad deploy, causing thundering herd on the primary DB.",
  "email": "smoke-test-$(date +%s)@example.invalid",
  "title": "Smoke test $(date +%s)"
}
EOF
)
SUBMIT_RESP=$(curl -fsS --max-time 30 -X POST "${RENDER_URL}/api/incidents" \
  -H "Content-Type: application/json" \
  --data "$SUBMIT_BODY" 2>&1) || {
  fail "POST /api/incidents did not return 2xx"
  echo "    Body: ${SUBMIT_RESP:0:300}"
  echo
}

if echo "$SUBMIT_RESP" | grep -q '"id":'; then
  pass "POST /api/incidents — submission accepted"
  SMOKE_ID=$(echo "$SUBMIT_RESP" | grep -oE '"id":"[^"]+"' | head -1 | sed 's/"id":"//;s/"$//')
  echo "    Incident id: $SMOKE_ID"
  warn "This submission is real — it'll show up in the admin queue. Clean it up via /admin → Archived."
else
  fail "POST /api/incidents — response shape unexpected"
  echo "    Body (first 300 chars): ${SUBMIT_RESP:0:300}"
fi
echo

# ---------- summary ----------
echo "==> Done"
if [ "$FAILED" -eq 0 ]; then
  printf '%sAll checks passed.%s\n' "$GREEN" "$RESET"
  exit 0
else
  printf '%sSome checks failed. See deploy/TROUBLESHOOTING.md.%s\n' "$RED" "$RESET"
  exit 1
fi
