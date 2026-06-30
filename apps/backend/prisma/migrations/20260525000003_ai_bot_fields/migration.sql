-- AlterTable: add AI chatbot fields to Conversation
ALTER TABLE "Conversation" ADD COLUMN "botEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "botPausedUntil" TIMESTAMP(3);
