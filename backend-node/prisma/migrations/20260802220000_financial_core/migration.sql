-- Phase 6.1 Financial core
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,
    CONSTRAINT "FinancialAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FinancialTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountFils" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "FinancialTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentNumber" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionId" TEXT,
    "amountFils" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "method" TEXT NOT NULL DEFAULT 'cash',
    "notes" TEXT,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,
    CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "MoneyMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "paymentId" TEXT,
    "transactionId" TEXT,
    "direction" TEXT NOT NULL,
    "amountFils" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IQD',
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "MoneyMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MoneyMovement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MoneyMovement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "FinancialAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValues" TEXT,
    "newValues" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "FinancialAccount_accountNumber_key" ON "FinancialAccount"("accountNumber");
CREATE UNIQUE INDEX "FinancialAccount_customerId_key" ON "FinancialAccount"("customerId");
CREATE INDEX "FinancialAccount_accountNumber_idx" ON "FinancialAccount"("accountNumber");
CREATE INDEX "FinancialAccount_customerId_idx" ON "FinancialAccount"("customerId");
CREATE INDEX "FinancialAccount_status_idx" ON "FinancialAccount"("status");
CREATE INDEX "FinancialAccount_deletedAt_idx" ON "FinancialAccount"("deletedAt");
CREATE INDEX "FinancialAccount_createdAt_idx" ON "FinancialAccount"("createdAt");

CREATE INDEX "FinancialTransaction_accountId_idx" ON "FinancialTransaction"("accountId");
CREATE INDEX "FinancialTransaction_type_idx" ON "FinancialTransaction"("type");
CREATE INDEX "FinancialTransaction_status_idx" ON "FinancialTransaction"("status");
CREATE INDEX "FinancialTransaction_referenceType_referenceId_idx" ON "FinancialTransaction"("referenceType", "referenceId");
CREATE INDEX "FinancialTransaction_createdAt_idx" ON "FinancialTransaction"("createdAt");

CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");
CREATE INDEX "Payment_accountId_idx" ON "Payment"("accountId");
CREATE INDEX "Payment_paymentNumber_idx" ON "Payment"("paymentNumber");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_deletedAt_idx" ON "Payment"("deletedAt");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

CREATE INDEX "MoneyMovement_accountId_idx" ON "MoneyMovement"("accountId");
CREATE INDEX "MoneyMovement_paymentId_idx" ON "MoneyMovement"("paymentId");
CREATE INDEX "MoneyMovement_transactionId_idx" ON "MoneyMovement"("transactionId");
CREATE INDEX "MoneyMovement_direction_idx" ON "MoneyMovement"("direction");
CREATE INDEX "MoneyMovement_kind_idx" ON "MoneyMovement"("kind");
CREATE INDEX "MoneyMovement_createdAt_idx" ON "MoneyMovement"("createdAt");

CREATE INDEX "FinancialAudit_entityType_entityId_idx" ON "FinancialAudit"("entityType", "entityId");
CREATE INDEX "FinancialAudit_action_idx" ON "FinancialAudit"("action");
CREATE INDEX "FinancialAudit_userId_idx" ON "FinancialAudit"("userId");
CREATE INDEX "FinancialAudit_createdAt_idx" ON "FinancialAudit"("createdAt");
