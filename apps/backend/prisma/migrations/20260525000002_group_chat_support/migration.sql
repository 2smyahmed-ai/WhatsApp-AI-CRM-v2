-- Sprint 3: Group Chat Support
-- Adds group metadata to Conversation and sender attribution to Message.

-- Conversation: group metadata columns
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "isGroup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "groupJid" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "groupName" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "participantCount" INTEGER;

-- Index for fast group conversation lookups by JID
CREATE INDEX IF NOT EXISTS "Conversation_groupJid_idx" ON "Conversation"("groupJid");

-- Message: per-message sender attribution for group messages
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "senderPhone" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "senderName" TEXT;
