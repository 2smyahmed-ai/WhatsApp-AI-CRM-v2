-- ─────────────────────────────────────────────────────────────────────────
-- Phase A — Normalized Message Schema (additive only)
--
-- Adds the columns and enum values required by the messaging-platform
-- refactor. No existing column is dropped, renamed, or made NOT NULL.
-- Legacy rows (schemaVersion=0) continue to work via the existing columns;
-- new rows (schemaVersion=1) carry the normalized payload in `content`,
-- `metadata`, `raw`, `renderable`.
--
-- See:
--   - packages/messaging-schema
--   - NORMALIZED_MESSAGE_DESIGN.md §11.1 (Phase A)
-- ─────────────────────────────────────────────────────────────────────────

-- ── MsgStatus enum: full ACK pipeline states ─────────────────────────────
ALTER TYPE "MsgStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "MsgStatus" ADD VALUE IF NOT EXISTS 'SENDING';
ALTER TYPE "MsgStatus" ADD VALUE IF NOT EXISTS 'PROVIDER_ACCEPTED';
ALTER TYPE "MsgStatus" ADD VALUE IF NOT EXISTS 'SERVER_CONFIRMED';
ALTER TYPE "MsgStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- ── Conversation: session-window + compatibility mode ────────────────────
ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "lastInboundAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "compatibilityMode" TEXT;

-- ── Message: normalized columns ──────────────────────────────────────────
ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "schemaVersion"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "clientId"       TEXT,
  ADD COLUMN IF NOT EXISTS "provider"       TEXT,
  ADD COLUMN IF NOT EXISTS "kind"           TEXT,
  ADD COLUMN IF NOT EXISTS "content"        JSONB,
  ADD COLUMN IF NOT EXISTS "metadata"       JSONB,
  ADD COLUMN IF NOT EXISTS "raw"            JSONB,
  ADD COLUMN IF NOT EXISTS "renderable"     JSONB,
  ADD COLUMN IF NOT EXISTS "sequenceNumber" BIGSERIAL NOT NULL;

-- ── Indexes ──────────────────────────────────────────────────────────────
-- Hot path: list messages for a conversation in deterministic order.
CREATE INDEX IF NOT EXISTS "Message_conversationId_sequenceNumber_idx"
  ON "Message" ("conversationId", "sequenceNumber" DESC);

-- Outbound idempotency: (clientId, conversationId) is unique. Multiple rows
-- with clientId=NULL are permitted because Postgres treats NULLs as distinct
-- in UNIQUE indexes by default — legacy rows are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "Message_clientId_conversationId_key"
  ON "Message" ("clientId", "conversationId");

-- ── Backfill: Conversation.lastInboundAt from existing INBOUND messages ──
-- One-time data backfill. Approved as part of Phase A so Meta session-window
-- evaluation works correctly on the first read after rollout.
UPDATE "Conversation" c
SET "lastInboundAt" = sub.last_inbound_at
FROM (
  SELECT "conversationId", MAX("timestamp") AS last_inbound_at
  FROM "Message"
  WHERE direction = 'INBOUND'
  GROUP BY "conversationId"
) AS sub
WHERE c.id = sub."conversationId"
  AND c."lastInboundAt" IS NULL;
