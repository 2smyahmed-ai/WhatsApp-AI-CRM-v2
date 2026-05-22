-- AlterTable
ALTER TABLE "MessageReaction" ADD COLUMN     "contactPhone" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_contactPhone_idx" ON "MessageReaction"("messageId", "contactPhone");
