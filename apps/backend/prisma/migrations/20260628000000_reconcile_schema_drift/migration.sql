-- Reconcile migration history with the Prisma schema.
-- Development used `prisma db push`, so several schema changes never received
-- migration files. Without this migration a fresh `prisma migrate deploy`
-- (i.e. a real production deployment) produces a database that does NOT match
-- schema.prisma — the Setting table is missing (breaks chatbot settings boot),
-- along with warmupEnabled, botOverride, interactivePayload, the INTERACTIVE
-- enum value, and a leftover legacy Contact.tag column.

-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'INTERACTIVE';

-- AlterTable: drop legacy CSV tag column (superseded by relational Tag/ContactTag)
ALTER TABLE "Contact" DROP COLUMN "tag";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "botOverride" BOOLEAN;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "interactivePayload" JSONB;

-- AlterTable
ALTER TABLE "WhatsAppSession" ADD COLUMN     "warmupEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
