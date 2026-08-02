-- Phase 6.5: settlement refs, unique charge/deposit refs, idempotency keys

-- Backfill-safe unique: collapse duplicate (type,referenceType,referenceId) rows first if any.
-- Dev DBs after Phase 6.3 reset should be clean.

ALTER TABLE "FinancialTransaction" ADD COLUMN "settlementId" TEXT;

CREATE UNIQUE INDEX "FinancialTransaction_type_referenceType_referenceId_key"
  ON "FinancialTransaction"("type", "referenceType", "referenceId");

CREATE INDEX "FinancialTransaction_settlementId_idx" ON "FinancialTransaction"("settlementId");

ALTER TABLE "Payment" ADD COLUMN "settlementId" TEXT;

CREATE INDEX "Payment_settlementId_idx" ON "Payment"("settlementId");

CREATE TABLE "FinanceIdempotencyKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "responseJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "FinanceIdempotencyKey_scope_key_key" ON "FinanceIdempotencyKey"("scope", "key");
CREATE INDEX "FinanceIdempotencyKey_resourceType_resourceId_idx" ON "FinanceIdempotencyKey"("resourceType", "resourceId");
CREATE INDEX "FinanceIdempotencyKey_createdAt_idx" ON "FinanceIdempotencyKey"("createdAt");
