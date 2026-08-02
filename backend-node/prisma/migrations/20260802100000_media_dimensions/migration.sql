-- AlterTable
ALTER TABLE "MediaFile" ADD COLUMN "width" INTEGER;
ALTER TABLE "MediaFile" ADD COLUMN "height" INTEGER;
ALTER TABLE "MediaFile" ADD COLUMN "orientation" INTEGER;

-- CreateIndex
CREATE INDEX "MediaFile_extension_idx" ON "MediaFile"("extension");
CREATE INDEX "MediaFile_mimeType_idx" ON "MediaFile"("mimeType");
CREATE INDEX "MediaFile_createdAt_idx" ON "MediaFile"("createdAt");
