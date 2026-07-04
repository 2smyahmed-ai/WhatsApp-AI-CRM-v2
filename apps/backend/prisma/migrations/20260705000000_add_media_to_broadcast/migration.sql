-- Add media columns to Broadcast so campaigns can deliver image / video / document
ALTER TABLE "Broadcast" ADD COLUMN "mediaUrl" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN "mediaType" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN "mediaFilename" TEXT;
