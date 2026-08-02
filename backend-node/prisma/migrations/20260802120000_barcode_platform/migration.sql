-- Barcode platform: symbology type + activated/retired vocabulary
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Barcode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'code128',
    "prefix" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "reservedAt" DATETIME,
    "activatedAt" DATETIME,
    "retiredAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT
);
INSERT INTO "new_Barcode" ("id", "code", "type", "prefix", "status", "entityType", "entityId", "reservedAt", "activatedAt", "retiredAt", "deletedAt", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT
  "id",
  "code",
  'code128',
  "prefix",
  CASE "status"
    WHEN 'allocated' THEN 'activated'
    WHEN 'released' THEN 'retired'
    ELSE "status"
  END,
  "entityType",
  "entityId",
  "reservedAt",
  "allocatedAt",
  "releasedAt",
  "deletedAt",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy"
FROM "Barcode";
DROP TABLE "Barcode";
ALTER TABLE "new_Barcode" RENAME TO "Barcode";
CREATE UNIQUE INDEX "Barcode_code_key" ON "Barcode"("code");
CREATE INDEX "Barcode_prefix_idx" ON "Barcode"("prefix");
CREATE INDEX "Barcode_status_idx" ON "Barcode"("status");
CREATE INDEX "Barcode_type_idx" ON "Barcode"("type");
CREATE INDEX "Barcode_entityType_entityId_idx" ON "Barcode"("entityType", "entityId");
CREATE INDEX "Barcode_deletedAt_idx" ON "Barcode"("deletedAt");
CREATE INDEX "Barcode_createdAt_idx" ON "Barcode"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
