/*
  Warnings:

  - Added the required column `direction` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `from` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `to` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "direction" "MessageDirection",
ADD COLUMN     "from" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "to" TEXT;

-- Backfill existing rows with best-effort values from current relations.
UPDATE "Message" m
SET
  "direction" = CASE WHEN m."fromMe" THEN 'OUTBOUND'::"MessageDirection" ELSE 'INBOUND'::"MessageDirection" END,
  "phone" = COALESCE(
    m."phone",
    c."phone"
  ),
  "from" = COALESCE(
    m."from",
    CASE WHEN m."fromMe" THEN c."phone" ELSE c."phone" END
  ),
  "to" = COALESCE(
    m."to",
    CASE WHEN m."fromMe" THEN c."phone" ELSE c."phone" END
  )
FROM "Conversation" conv
JOIN "Contact" c ON c."id" = conv."contactId"
WHERE conv."id" = m."conversationId";

ALTER TABLE "Message" ALTER COLUMN "direction" SET NOT NULL,
ALTER COLUMN "from" SET NOT NULL,
ALTER COLUMN "phone" SET NOT NULL,
ALTER COLUMN "to" SET NOT NULL;
