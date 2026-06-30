-- Drop the global unique constraint on shortcut
DROP INDEX IF EXISTS "SavedReply_shortcut_key";

-- Add team-scoped unique constraint: shortcut must be unique within a team
-- (NULL teamId rows are each considered distinct per PostgreSQL NULL semantics)
CREATE UNIQUE INDEX "SavedReply_teamId_shortcut_key" ON "SavedReply"("teamId", "shortcut");
