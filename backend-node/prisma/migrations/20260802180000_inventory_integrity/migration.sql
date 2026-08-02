-- Phase 4.4: inventory integrity remediation
-- - Capture catalog status at soft-delete for consistent restore
-- - Remove ItemMedia; MediaReference is the sole attachment strategy

ALTER TABLE "Item" ADD COLUMN "statusBeforeDelete" TEXT;

-- Drop ItemMedia (data migrated only if present; greenfield/dev DBs are empty)
DROP TABLE IF EXISTS "ItemMedia";
