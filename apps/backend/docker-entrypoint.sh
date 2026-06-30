#!/bin/sh
# Apply pending migrations against this tenant's database, then start the server.
# Idempotent: `migrate deploy` is a no-op when the schema is already current.
set -e

echo "[entrypoint] Applying database migrations…"
npx prisma migrate deploy --schema prisma/schema.prisma

echo "[entrypoint] Starting backend…"
exec node dist/index.js
