-- Phase 4.2 Inventory Lifecycle Foundation
ALTER TABLE "Item" ADD COLUMN "lifecycleState" TEXT NOT NULL DEFAULT 'available';

CREATE INDEX "Item_lifecycleState_idx" ON "Item"("lifecycleState");
CREATE INDEX "Item_lifecycleState_deletedAt_idx" ON "Item"("lifecycleState", "deletedAt");

CREATE TABLE "ItemStateHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "oldState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemStateHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ItemStateHistory_itemId_idx" ON "ItemStateHistory"("itemId");
CREATE INDEX "ItemStateHistory_newState_idx" ON "ItemStateHistory"("newState");
CREATE INDEX "ItemStateHistory_createdAt_idx" ON "ItemStateHistory"("createdAt");
CREATE INDEX "ItemStateHistory_referenceType_referenceId_idx" ON "ItemStateHistory"("referenceType", "referenceId");
