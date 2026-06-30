-- AI Lead Qualification & Sales Intelligence System
-- Adds per-contact AI qualification, append-only status history, and
-- persistent per-recipient notifications. Advisory-only: no existing
-- Conversation/Contact columns are modified by this feature.

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "LeadStatus" AS ENUM (
    'NEW_LEAD', 'QUALIFIED', 'HOT', 'WARM', 'COLD',
    'CUSTOMER', 'LOST', 'NOT_INTERESTED', 'SPAM'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'BUYING_INTENT', 'NEEDS_ATTENTION', 'STATUS_UPGRADE'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── LeadQualification ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeadQualification" (
  "id"                     TEXT NOT NULL,
  "contactId"              TEXT NOT NULL,
  "teamId"                 TEXT,
  "status"                 "LeadStatus" NOT NULL DEFAULT 'NEW_LEAD',
  "score"                  INTEGER NOT NULL DEFAULT 0,
  "priority"               "Priority" NOT NULL DEFAULT 'NORMAL',
  "confidence"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "needsAttention"         BOOLEAN NOT NULL DEFAULT false,
  "buyingIntent"           BOOLEAN NOT NULL DEFAULT false,
  "signals"                JSONB,
  "summaryEn"              TEXT,
  "summaryAr"              TEXT,
  "recommendationEn"       TEXT,
  "recommendationAr"       TEXT,
  "messageCountAtAnalysis" INTEGER NOT NULL DEFAULT 0,
  "lastAnalyzedAt"         TIMESTAMP(3),
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadQualification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadQualification_contactId_key" ON "LeadQualification"("contactId");
CREATE INDEX IF NOT EXISTS "LeadQualification_teamId_status_idx" ON "LeadQualification"("teamId", "status");
CREATE INDEX IF NOT EXISTS "LeadQualification_teamId_priority_idx" ON "LeadQualification"("teamId", "priority");
CREATE INDEX IF NOT EXISTS "LeadQualification_teamId_needsAttention_idx" ON "LeadQualification"("teamId", "needsAttention");
CREATE INDEX IF NOT EXISTS "LeadQualification_teamId_score_idx" ON "LeadQualification"("teamId", "score" DESC);

-- ── LeadStatusEvent (append-only history) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeadStatusEvent" (
  "id"              TEXT NOT NULL,
  "qualificationId" TEXT NOT NULL,
  "contactId"       TEXT NOT NULL,
  "teamId"          TEXT,
  "fromStatus"      "LeadStatus",
  "toStatus"        "LeadStatus" NOT NULL,
  "score"           INTEGER NOT NULL DEFAULT 0,
  "reason"          TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadStatusEvent_contactId_createdAt_idx" ON "LeadStatusEvent"("contactId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "LeadStatusEvent_qualificationId_createdAt_idx" ON "LeadStatusEvent"("qualificationId", "createdAt" DESC);

-- ── Notification ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"             TEXT NOT NULL,
  "recipientId"    TEXT NOT NULL,
  "teamId"         TEXT,
  "type"           "NotificationType" NOT NULL,
  "priority"       "Priority" NOT NULL DEFAULT 'NORMAL',
  "title"          TEXT NOT NULL,
  "body"           TEXT,
  "contactId"      TEXT,
  "conversationId" TEXT,
  "isRead"         BOOLEAN NOT NULL DEFAULT false,
  "readAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_recipientId_isRead_createdAt_idx" ON "Notification"("recipientId", "isRead", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt" DESC);

-- ── Foreign keys ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "LeadQualification"
    ADD CONSTRAINT "LeadQualification_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "LeadStatusEvent"
    ADD CONSTRAINT "LeadStatusEvent_qualificationId_fkey"
    FOREIGN KEY ("qualificationId") REFERENCES "LeadQualification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
