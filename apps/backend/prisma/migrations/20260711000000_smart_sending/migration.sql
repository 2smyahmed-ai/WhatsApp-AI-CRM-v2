-- Smart Sending: batched broadcast delivery that survives restarts.
--
-- Idempotent (IF NOT EXISTS / guarded), because this project keeps the live
-- database in sync with `prisma db push` and the migration history has drifted.
-- Re-applying this to an already-pushed database is a no-op.

-- ── Batching columns on Broadcast ───────────────────────────────────────────────
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "smartSending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "batchSize" INTEGER;
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "batchIntervalMinutes" INTEGER;
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "nextBatchAt" TIMESTAMP(3);

-- ── CANCELLED broadcast status ──────────────────────────────────────────────────
-- `ADD VALUE IF NOT EXISTS` is a top-level statement (it cannot run inside a
-- DO/function block), so it is written plainly here.
ALTER TYPE "BroadcastStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- ── Due-batch poll index ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Broadcast_status_nextBatchAt_idx" ON "Broadcast" ("status", "nextBatchAt");
