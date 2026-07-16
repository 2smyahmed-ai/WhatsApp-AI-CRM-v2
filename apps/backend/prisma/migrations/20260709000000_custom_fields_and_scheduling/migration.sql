-- Custom contact fields, durable broadcast scheduling, and template attachments.
--
-- Written idempotently (IF NOT EXISTS / guarded DO blocks) because this project's
-- schema is maintained with `prisma db push` and the migration history has drifted
-- from the live database. Applying this file to a database that `db push` already
-- brought up to date is a no-op; applying it to a fresh one produces the same shape.

-- ── Contact.company ─────────────────────────────────────────────────────────────
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "company" TEXT;

-- ── Custom field definitions ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CustomFieldType') THEN
    CREATE TYPE "CustomFieldType" AS ENUM (
      'TEXT', 'NUMBER', 'EMAIL', 'PHONE', 'DATE', 'SELECT',
      'MULTI_SELECT', 'CHECKBOX', 'URL', 'CURRENCY', 'NOTES'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CustomFieldDefinition" (
  "id"           TEXT NOT NULL,
  "teamId"       TEXT,
  "key"          TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "type"         "CustomFieldType" NOT NULL DEFAULT 'TEXT',
  "options"      JSONB,
  "required"     BOOLEAN NOT NULL DEFAULT false,
  "defaultValue" JSONB,
  "placeholder"  TEXT,
  "helpText"     TEXT,
  "currency"     TEXT,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomFieldDefinition_teamId_key_key"
  ON "CustomFieldDefinition" ("teamId", "key");
CREATE INDEX IF NOT EXISTS "CustomFieldDefinition_teamId_order_idx"
  ON "CustomFieldDefinition" ("teamId", "order");

-- ── Broadcast scheduling + media ────────────────────────────────────────────────
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "mediaMimeType" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "queuedAt" TIMESTAMP(3);
ALTER TABLE "Broadcast" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

-- Drives the scheduler's "which broadcasts are due?" poll.
CREATE INDEX IF NOT EXISTS "Broadcast_status_scheduledAt_idx"
  ON "Broadcast" ("status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "BroadcastRecipient_broadcastId_status_idx"
  ON "BroadcastRecipient" ("broadcastId", "status");

-- ── Template attachments ────────────────────────────────────────────────────────
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "mediaType" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "mediaFilename" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "mediaMimeType" TEXT;

-- ── Backfill: absolute media URLs → storage-relative refs ───────────────────────
-- Attachments used to be stored as whatever absolute URL the browser built
-- ("http://localhost:4000/uploads/x.jpg"). That breaks the moment the host or
-- port changes.
--
-- Only loopback hosts are rewritten here. An S3 object URL also carries an
-- "/uploads/" path (its key is "uploads/<file>"), so a blanket rewrite would
-- turn a perfectly portable bucket URL into a local path and send every read
-- looking on disk. Everything else is normalized at read time by
-- `toStorageRef`, which knows whether this deployment uses S3 or local disk.
UPDATE "Broadcast"
   SET "mediaUrl" = '/uploads/' || split_part("mediaUrl", '/uploads/', 2)
 WHERE "mediaUrl" ~ '^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:[0-9]+)?/uploads/';

UPDATE "MessageTemplate"
   SET "mediaUrl" = '/uploads/' || split_part("mediaUrl", '/uploads/', 2)
 WHERE "mediaUrl" ~ '^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:[0-9]+)?/uploads/';

-- Recover the media type for templates that already carry a canonical payload,
-- so an existing image template keeps rendering as one.
UPDATE "MessageTemplate"
   SET "mediaType" = "payload"->'media'->>'type',
       "mediaFilename" = COALESCE("mediaFilename", "payload"->'media'->>'filename')
 WHERE "mediaType" IS NULL
   AND "payload" IS NOT NULL
   AND "payload"->'media'->>'type' IS NOT NULL;
