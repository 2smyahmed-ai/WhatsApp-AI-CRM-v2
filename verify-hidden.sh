#!/usr/bin/env bash
# Verifies the developer super-account is hidden from customer-facing user lists
# but can still log in. Run on a Docker host.
set -euo pipefail

SLUG="hidetest"; PROJECT="crm-$SLUG"; BPORT="4198"; FPORT="3198"
ENV_FILE="tenants/$SLUG/.env"
OWNER_EMAIL="owner@hidetest.com"; OWNER_PASS="OwnerHidePass12345"
DEV_EMAIL="secretdev@example.com"; DEV_PASS="DevHidePass12345"
API="http://localhost:$BPORT"

cleanup() {
  docker compose --env-file "$ENV_FILE" -f docker-compose.tenant.yml -p "$PROJECT" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "tenants/$SLUG"
}
trap cleanup EXIT
docker compose -p "$PROJECT" down -v --remove-orphans >/dev/null 2>&1 || true
rm -rf "tenants/$SLUG"

echo "→ Provisioning tenant with a hidden dev account…"
npm run provision-tenant --workspace=apps/backend -- \
  --slug "$SLUG" --name "Hide Test" \
  --admin-email "$OWNER_EMAIL" --admin-password "$OWNER_PASS" \
  --public-url "http://localhost:$FPORT" --frontend-port "$FPORT" --backend-port "$BPORT" \
  --dev-email "$DEV_EMAIL" --dev-password "$DEV_PASS" >/dev/null

echo "→ Building + starting…"
docker compose --env-file "$ENV_FILE" -f docker-compose.tenant.yml -p "$PROJECT" up -d --build >/dev/null 2>&1

echo "→ Waiting for backend…"
for i in $(seq 1 60); do curl -fsS "$API/health" >/dev/null 2>&1 && break; [ "$i" -eq 60 ] && { echo "✗ backend down"; docker compose -p "$PROJECT" logs --tail 40 backend; exit 1; }; sleep 5; done

login() { curl -fsS -X POST "$API/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}"; }

echo "→ Owner login…"
OWNER_TOKEN=$(login "$OWNER_EMAIL" "$OWNER_PASS" | sed -E 's/.*"token":"([^"]+)".*/\1/')
[ -n "$OWNER_TOKEN" ] || { echo "✗ owner login failed"; exit 1; }

echo "→ Owner creates a normal agent…"
curl -fsS -X POST "$API/api/users" -H "Authorization: Bearer $OWNER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Normal Agent","email":"agent@hidetest.com","password":"AgentPass12345","role":"AGENT"}' >/dev/null

echo "→ Checking GET /api/users (owner view)…"
USERS=$(curl -fsS "$API/api/users" -H "Authorization: Bearer $OWNER_TOKEN")
echo "$USERS" | grep -q 'agent@hidetest.com' || { echo "✗ normal agent missing from list"; echo "$USERS"; exit 1; }
if echo "$USERS" | grep -q "$DEV_EMAIL"; then echo "✗ FAIL: dev account is VISIBLE in /api/users"; echo "$USERS"; exit 1; fi
echo "  ✓ normal agent present, dev account hidden"

echo "→ Checking GET /api/teams/agents (assignment picker)…"
AGENTS=$(curl -fsS "$API/api/teams/agents" -H "Authorization: Bearer $OWNER_TOKEN")
if echo "$AGENTS" | grep -q "$DEV_EMAIL"; then echo "✗ FAIL: dev account is VISIBLE in /api/teams/agents"; echo "$AGENTS"; exit 1; fi
echo "  ✓ dev account hidden from agent picker"

echo "→ Confirming the hidden dev can still log in with full access…"
DEV_LOGIN=$(login "$DEV_EMAIL" "$DEV_PASS")
echo "$DEV_LOGIN" | grep -q '"token"' || { echo "✗ dev login failed: $DEV_LOGIN"; exit 1; }
echo "$DEV_LOGIN" | grep -q 'SUPER_ADMIN' || { echo "✗ dev not SUPER_ADMIN: $DEV_LOGIN"; exit 1; }
echo "  ✓ dev logs in as SUPER_ADMIN"

echo ""
echo "✅ HIDDEN-ACCOUNT CHECK PASSED — dev account is invisible in user lists yet fully functional."
