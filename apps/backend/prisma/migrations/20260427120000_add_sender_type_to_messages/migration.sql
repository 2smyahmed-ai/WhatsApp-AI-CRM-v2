-- AlterTable
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "senderType" TEXT NOT NULL DEFAULT 'user';
