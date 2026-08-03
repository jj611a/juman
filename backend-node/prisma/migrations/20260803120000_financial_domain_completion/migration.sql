-- Phase 6.6: financial domain completion — settlement components + refund/adjustment/discount/late fee

ALTER TABLE "RentalSettlement" ADD COLUMN "chargeFils" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RentalSettlement" ADD COLUMN "depositFils" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RentalSettlement" ADD COLUMN "lateFeeFils" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RentalSettlement" ADD COLUMN "adjustmentFils" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RentalSettlement" ADD COLUMN "discountFils" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RentalSettlement" ADD COLUMN "refundFils" INTEGER NOT NULL DEFAULT 0;

-- Backfill: prior settlements stored total = charge − deposit with no modifiers.
UPDATE "RentalSettlement"
SET "chargeFils" = "totalFils" + "depositFils"
WHERE "chargeFils" = 0 AND "totalFils" >= 0;

CREATE TABLE "SettlementRefund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refundNumber" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "amountFils" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "transactionId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "SettlementRefund_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RentalSettlement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SettlementRefund_refundNumber_key" ON "SettlementRefund"("refundNumber");
CREATE UNIQUE INDEX "SettlementRefund_transactionId_key" ON "SettlementRefund"("transactionId");
CREATE INDEX "SettlementRefund_settlementId_idx" ON "SettlementRefund"("settlementId");
CREATE INDEX "SettlementRefund_refundNumber_idx" ON "SettlementRefund"("refundNumber");
CREATE INDEX "SettlementRefund_status_idx" ON "SettlementRefund"("status");
CREATE INDEX "SettlementRefund_createdAt_idx" ON "SettlementRefund"("createdAt");

CREATE TABLE "SettlementRefundHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refundId" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementRefundHistory_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "SettlementRefund" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "SettlementRefundHistory_refundId_idx" ON "SettlementRefundHistory"("refundId");
CREATE INDEX "SettlementRefundHistory_action_idx" ON "SettlementRefundHistory"("action");
CREATE INDEX "SettlementRefundHistory_createdAt_idx" ON "SettlementRefundHistory"("createdAt");

CREATE TABLE "SettlementAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementId" TEXT NOT NULL,
    "amountFils" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "transactionId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "SettlementAdjustment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RentalSettlement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SettlementAdjustment_transactionId_key" ON "SettlementAdjustment"("transactionId");
CREATE INDEX "SettlementAdjustment_settlementId_idx" ON "SettlementAdjustment"("settlementId");
CREATE INDEX "SettlementAdjustment_status_idx" ON "SettlementAdjustment"("status");
CREATE INDEX "SettlementAdjustment_createdAt_idx" ON "SettlementAdjustment"("createdAt");

CREATE TABLE "SettlementDiscount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "basis" TEXT NOT NULL DEFAULT 'settlement',
    "percentBps" INTEGER,
    "amountFils" INTEGER,
    "computedFils" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "transactionId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "SettlementDiscount_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RentalSettlement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SettlementDiscount_transactionId_key" ON "SettlementDiscount"("transactionId");
CREATE INDEX "SettlementDiscount_settlementId_idx" ON "SettlementDiscount"("settlementId");
CREATE INDEX "SettlementDiscount_kind_idx" ON "SettlementDiscount"("kind");
CREATE INDEX "SettlementDiscount_status_idx" ON "SettlementDiscount"("status");
CREATE INDEX "SettlementDiscount_createdAt_idx" ON "SettlementDiscount"("createdAt");

CREATE TABLE "SettlementLateFee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "flatFils" INTEGER,
    "dailyFils" INTEGER,
    "maxFils" INTEGER,
    "daysCharged" INTEGER,
    "computedFils" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "assessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "SettlementLateFee_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RentalSettlement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SettlementLateFee_transactionId_key" ON "SettlementLateFee"("transactionId");
CREATE INDEX "SettlementLateFee_settlementId_idx" ON "SettlementLateFee"("settlementId");
CREATE INDEX "SettlementLateFee_kind_idx" ON "SettlementLateFee"("kind");
CREATE INDEX "SettlementLateFee_status_idx" ON "SettlementLateFee"("status");
CREATE INDEX "SettlementLateFee_assessedAt_idx" ON "SettlementLateFee"("assessedAt");
CREATE INDEX "SettlementLateFee_createdAt_idx" ON "SettlementLateFee"("createdAt");
