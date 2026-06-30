#!/usr/bin/env bash
# End-to-end deployment smoke test. Run on a host with Docker installed.
# Provisions a throwaway tenant, builds + boots the full stack, and checks that
# the DB migrated, the owner was seeded, auth works, and the frontend serves.
#
#   bash verify-deploy.sh
#
# On success it prints GREEN LIGHT and tears the test stack down (incl. volumes).
set -euo pipefail

SLUG="verifytest"
PROJECT="crm-$SLUG"
BACKEND_PORT="4199"
FRONTEND_PORT="3199"
OWNER_EMAIL="verify@example.com"
OWNER_PASSWORD="VerifyPass12345"
ENV_FILE="tenants/$SLUG/.env"

cleanup() {
  echo "→ Tearing down test stack…"
  docker compose --env-file "$ENV_FILE" -f docker-compose.tenant.yml -p "$PROJECT" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "tenants/$SLUG"
}
trap cleanup EXIT

echo "→ Cleaning any previous test tenant…"
docker compose -p "$PROJECT" down -v --remove-orphans >/dev/null 2>&1 || true
rm -rf "tenants/$SLUG"

echo "→ Provisioning test tenant…"
npm run provision-tenant --workspace=apps/backend -- \
  --slug "$SLUG" \
  --name "Verify Test" \
  --admin-email "$OWNER_EMAIL" \
  --admin-password "$OWNER_PASSWORD" \
  --public-url "http://localhost:$FRONTEND_PORT" \
  --frontend-port "$FRONTEND_PORT" \
  --backend-port "$BACKEND_PORT" \
  --dev-email "dev@example.com" \
  --dev-password "DevVerifyPass12345"

echo "→ Building + starting the stack (first build can take a few minutes)…"
docker compose --env-file "$ENV_FILE" -f docker-compose.tenant.yml -p "$PROJECT" up -d --build

echo "→ Waiting for backend /health (migrations run on boot)…"
for i in $(seq 1 60); do
  if curl -fsS "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
    echo "  backend healthy after ${i}0s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "✗ Backend never became healthy. Logs:"
    docker compose -p "$PROJECT" logs --tail 50 backend
    exit 1
  fi
  sleep 10
done

echo "→ Testing owner login (proves DB migrated + owner seeded + auth works)…"
LOGIN=$(curl -fsS -X POST "http://localhost:$BACKEND_PORT/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$OWNER_PASSWORD\"}" || true)
if ! echo "$LOGIN" | grep -q '"token"'; then
  echo "✗ Owner login failed. Response: $LOGIN"
  docker compose -p "$PROJECT" logs --tail 50 backend
  exit 1
fi
echo "  owner login OK"

echo "→ Testing developer super-account login…"
DEV=$(curl -fsS -X POST "http://localhost:$BACKEND_PORT/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","password":"DevVerifyPass12345"}' || true)
echo "$DEV" | grep -q '"token"' && echo "  dev login OK" || { echo "✗ Dev login failed: $DEV"; exit 1; }

echo "→ Testing frontend serves…"
if curl -fsS "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
  echo "  frontend OK"
else
  echo "✗ Frontend did not respond on :$FRONTEND_PORT"
  docker compose -p "$PROJECT" logs --tail 30 frontend
  exit 1
fi

echo ""
echo "✅ GREEN LIGHT — build, boot, migrate, seed, auth, and frontend all verified."
echo "   You're clear to provision real tenants (see ONBOARDING.md)."
