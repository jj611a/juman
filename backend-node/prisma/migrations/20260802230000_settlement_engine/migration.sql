-- Phase 6.2 Settlement engine
CREATE TABLE "RentalSettlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementNumber" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "totalFils" INTEGER NOT NULL,
    "paidFils" INTEGER NOT NULL DEFAULT 0,
    "remainingFils" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "notes" TEXT,
    "closedAt" DATETIME,
    "cancelledAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,
    CONSTRAINT "RentalSettlement_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RentalSettlement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "SettlementHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementId" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amountFils" INTEGER,
    "paymentId" TEXT,
    "reason" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementHistory_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RentalSettlement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RentalSettlement_settlementNumber_key" ON "RentalSettlement"("settlementNumber");
CREATE UNIQUE INDEX "RentalSettlement_rentalId_key" ON "RentalSettlement"("rentalId");
CREATE INDEX "RentalSettlement_settlementNumber_idx" ON "RentalSettlement"("settlementNumber");
CREATE INDEX "RentalSettlement_rentalId_idx" ON "RentalSettlement"("rentalId");
CREATE INDEX "RentalSettlement_accountId_idx" ON "RentalSettlement"("accountId");
CREATE INDEX "RentalSettlement_customerId_idx" ON "RentalSettlement"("customerId");
CREATE INDEX "RentalSettlement_status_idx" ON "RentalSettlement"("status");
CREATE INDEX "RentalSettlement_deletedAt_idx" ON "RentalSettlement"("deletedAt");
CREATE INDEX "RentalSettlement_createdAt_idx" ON "RentalSettlement"("createdAt");
CREATE INDEX "RentalSettlement_status_deletedAt_idx" ON "RentalSettlement"("status", "deletedAt");

CREATE INDEX "SettlementHistory_settlementId_idx" ON "SettlementHistory"("settlementId");
CREATE INDEX "SettlementHistory_action_idx" ON "SettlementHistory"("action");
CREATE INDEX "SettlementHistory_paymentId_idx" ON "SettlementHistory"("paymentId");
CREATE INDEX "SettlementHistory_newStatus_idx" ON "SettlementHistory"("newStatus");
CREATE INDEX "SettlementHistory_createdAt_idx" ON "SettlementHistory"("createdAt");
