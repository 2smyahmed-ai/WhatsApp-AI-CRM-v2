-- CreateTable
CREATE TABLE "SavedReply" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "shortcut" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedReply_shortcut_key" ON "SavedReply"("shortcut");
