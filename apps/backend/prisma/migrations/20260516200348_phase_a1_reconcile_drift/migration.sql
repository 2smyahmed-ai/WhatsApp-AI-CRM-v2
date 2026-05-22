-- ─────────────────────────────────────────────────────────────────────────
-- Phase A.1 — Reconcile pre-existing drift
--
-- Two unrelated drifts were discovered while running Phase A:
--
--  1. `Message.interactivePayload` (JSONB) was added directly via raw SQL
--     before this refactor and contains 18 rows of real interactive-message
--     data (buttons + image headers). It was missing from schema.prisma
--     and from migration history. Resolution: declared in schema.prisma
--     as `interactivePayload Json?` so Prisma round-trips it. No DDL needed
--     in this migration — the column already exists.
--     Phase D will migrate this data into `content` / `renderable` and
--     drop the column.
--
--  2. `MessageTemplate` was declared in schema.prisma with Meta Cloud API
--     fields (`language`, `category`, `metaStatus`, `metaTemplateId`) that
--     never made it to the DB. Code in services/meta-template.service.ts
--     references these. This migration adds them.
--
-- Both fixes are additive — zero behavior change for legacy code paths.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "MessageTemplate"
  ADD COLUMN IF NOT EXISTS "category"       TEXT,
  ADD COLUMN IF NOT EXISTS "language"       TEXT NOT NULL DEFAULT 'en_US',
  ADD COLUMN IF NOT EXISTS "metaStatus"     TEXT,
  ADD COLUMN IF NOT EXISTS "metaTemplateId" TEXT;
