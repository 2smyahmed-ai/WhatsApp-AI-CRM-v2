-- DropIndex
DROP INDEX IF EXISTS "SavedReply_shortcut_key";

-- CreateIndex
CREATE UNIQUE INDEX "SavedReply_teamId_shortcut_key" ON "SavedReply"("teamId", "shortcut");
