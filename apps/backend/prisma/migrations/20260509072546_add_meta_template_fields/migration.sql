-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "category" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en_US',
ADD COLUMN     "metaStatus" TEXT,
ADD COLUMN     "metaTemplateId" TEXT;
