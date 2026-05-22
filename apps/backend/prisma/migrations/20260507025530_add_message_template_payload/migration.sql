-- CreateEnum
CREATE TYPE "FlowStepType" AS ENUM ('SEND_MESSAGE', 'WAIT');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('TEXT', 'MEDIA', 'INTERACTIVE');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterEnum
ALTER TYPE "BroadcastStatus" ADD VALUE 'PAUSED';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "replyToBody" TEXT,
ADD COLUMN     "replyToId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "conversationId" TEXT,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "autoAssign" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactTag" (
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("contactId","tagId")
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationFlow" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "trigger" "TriggerType" NOT NULL,
    "keyword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stopOnReply" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationFlowStep" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "FlowStepType" NOT NULL,
    "message" TEXT,
    "delayMs" INTEGER,

    CONSTRAINT "AutomationFlowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationFlowExecution" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "stoppedReason" TEXT,

    CONSTRAINT "AutomationFlowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "type" "TemplateType" NOT NULL DEFAULT 'TEXT',
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB,
    "variables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tag_teamId_idx" ON "Tag"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_teamId_name_key" ON "Tag"("teamId", "name");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_key" ON "MessageReaction"("messageId", "userId");

-- CreateIndex
CREATE INDEX "AutomationFlow_teamId_isActive_idx" ON "AutomationFlow"("teamId", "isActive");

-- CreateIndex
CREATE INDEX "AutomationFlowStep_flowId_order_idx" ON "AutomationFlowStep"("flowId", "order");

-- CreateIndex
CREATE INDEX "AutomationFlowExecution_flowId_phone_status_idx" ON "AutomationFlowExecution"("flowId", "phone", "status");

-- CreateIndex
CREATE INDEX "AutomationFlowExecution_phone_status_idx" ON "AutomationFlowExecution"("phone", "status");

-- CreateIndex
CREATE INDEX "MessageTemplate_teamId_idx" ON "MessageTemplate"("teamId");

-- CreateIndex
CREATE INDEX "Contact_teamId_idx" ON "Contact"("teamId");

-- CreateIndex
CREATE INDEX "Contact_phone_idx" ON "Contact"("phone");

-- CreateIndex
CREATE INDEX "Conversation_teamId_status_lastMessageAt_idx" ON "Conversation"("teamId", "status", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "Conversation_contactId_status_idx" ON "Conversation"("contactId", "status");

-- CreateIndex
CREATE INDEX "Conversation_assignedTo_idx" ON "Conversation"("assignedTo");

-- CreateIndex
CREATE INDEX "Conversation_snoozedUntil_idx" ON "Conversation"("snoozedUntil");

-- CreateIndex
CREATE INDEX "Message_conversationId_timestamp_idx" ON "Message"("conversationId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "Message_phone_idx" ON "Message"("phone");

-- AddForeignKey
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationFlowStep" ADD CONSTRAINT "AutomationFlowStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AutomationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationFlowExecution" ADD CONSTRAINT "AutomationFlowExecution_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "AutomationFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
