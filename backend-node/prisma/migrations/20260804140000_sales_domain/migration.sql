-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subtotalFils" INTEGER NOT NULL DEFAULT 0,
    "discountFils" INTEGER NOT NULL DEFAULT 0,
    "taxFils" INTEGER NOT NULL DEFAULT 0,
    "totalFils" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "completedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "priceFils" INTEGER NOT NULL DEFAULT 0,
    "discountFils" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalFils" INTEGER NOT NULL DEFAULT 0,
    "barcodeSnapshot" TEXT,
    "itemNameSnapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SaleItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleHistory_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancialTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountFils" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "settlementId" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "FinancialTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RentalSettlement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FinancialTransaction" ("accountId", "amountFils", "createdAt", "createdBy", "description", "id", "referenceId", "referenceType", "settlementId", "status", "type", "updatedAt", "updatedBy") SELECT "accountId", "amountFils", "createdAt", "createdBy", "description", "id", "referenceId", "referenceType", "settlementId", "status", "type", "updatedAt", "updatedBy" FROM "FinancialTransaction";
DROP TABLE "FinancialTransaction";
ALTER TABLE "new_FinancialTransaction" RENAME TO "FinancialTransaction";
CREATE INDEX "FinancialTransaction_accountId_idx" ON "FinancialTransaction"("accountId");
CREATE INDEX "FinancialTransaction_type_idx" ON "FinancialTransaction"("type");
CREATE INDEX "FinancialTransaction_status_idx" ON "FinancialTransaction"("status");
CREATE INDEX "FinancialTransaction_referenceType_referenceId_idx" ON "FinancialTransaction"("referenceType", "referenceId");
CREATE INDEX "FinancialTransaction_settlementId_idx" ON "FinancialTransaction"("settlementId");
CREATE INDEX "FinancialTransaction_createdAt_idx" ON "FinancialTransaction"("createdAt");
CREATE INDEX "FinancialTransaction_status_type_createdAt_idx" ON "FinancialTransaction"("status", "type", "createdAt");
CREATE UNIQUE INDEX "FinancialTransaction_type_referenceType_referenceId_key" ON "FinancialTransaction"("type", "referenceType", "referenceId");
CREATE TABLE "new_ItemBarcode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "barcodeId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "ItemBarcode_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemBarcode_barcodeId_fkey" FOREIGN KEY ("barcodeId") REFERENCES "Barcode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ItemBarcode" ("barcodeId", "createdAt", "createdBy", "deletedAt", "id", "isPrimary", "itemId", "updatedAt", "updatedBy") SELECT "barcodeId", "createdAt", "createdBy", "deletedAt", "id", "isPrimary", "itemId", "updatedAt", "updatedBy" FROM "ItemBarcode";
DROP TABLE "ItemBarcode";
ALTER TABLE "new_ItemBarcode" RENAME TO "ItemBarcode";
CREATE UNIQUE INDEX "ItemBarcode_barcodeId_key" ON "ItemBarcode"("barcodeId");
CREATE INDEX "ItemBarcode_itemId_idx" ON "ItemBarcode"("itemId");
CREATE INDEX "ItemBarcode_barcodeId_idx" ON "ItemBarcode"("barcodeId");
CREATE INDEX "ItemBarcode_deletedAt_idx" ON "ItemBarcode"("deletedAt");
CREATE TABLE "new_ItemStateHistory" (
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
    CONSTRAINT "ItemStateHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ItemStateHistory" ("createdAt", "id", "itemId", "newState", "oldState", "reason", "referenceId", "referenceType", "userId", "username") SELECT "createdAt", "id", "itemId", "newState", "oldState", "reason", "referenceId", "referenceType", "userId", "username" FROM "ItemStateHistory";
DROP TABLE "ItemStateHistory";
ALTER TABLE "new_ItemStateHistory" RENAME TO "ItemStateHistory";
CREATE INDEX "ItemStateHistory_itemId_idx" ON "ItemStateHistory"("itemId");
CREATE INDEX "ItemStateHistory_newState_idx" ON "ItemStateHistory"("newState");
CREATE INDEX "ItemStateHistory_createdAt_idx" ON "ItemStateHistory"("createdAt");
CREATE INDEX "ItemStateHistory_referenceType_referenceId_idx" ON "ItemStateHistory"("referenceType", "referenceId");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentNumber" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "settlementId" TEXT,
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
    CONSTRAINT "Payment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RentalSettlement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "FinancialTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("accountId", "amountFils", "cancelledAt", "completedAt", "createdAt", "createdBy", "deletedAt", "deletedBy", "id", "method", "notes", "paymentNumber", "settlementId", "status", "transactionId", "updatedAt", "updatedBy") SELECT "accountId", "amountFils", "cancelledAt", "completedAt", "createdAt", "createdBy", "deletedAt", "deletedBy", "id", "method", "notes", "paymentNumber", "settlementId", "status", "transactionId", "updatedAt", "updatedBy" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");
CREATE INDEX "Payment_accountId_idx" ON "Payment"("accountId");
CREATE INDEX "Payment_settlementId_idx" ON "Payment"("settlementId");
CREATE INDEX "Payment_paymentNumber_idx" ON "Payment"("paymentNumber");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_deletedAt_idx" ON "Payment"("deletedAt");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");
CREATE INDEX "Payment_completedAt_idx" ON "Payment"("completedAt");
CREATE INDEX "Payment_status_completedAt_idx" ON "Payment"("status", "completedAt");
CREATE TABLE "new_Rental" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rentalNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reservationId" TEXT,
    "rentalDate" DATETIME NOT NULL,
    "expectedReturnDate" DATETIME NOT NULL,
    "actualReturnDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,
    CONSTRAINT "Rental_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Rental_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Rental" ("actualReturnDate", "createdAt", "createdBy", "customerId", "deletedAt", "deletedBy", "expectedReturnDate", "id", "notes", "rentalDate", "rentalNumber", "reservationId", "status", "updatedAt", "updatedBy") SELECT "actualReturnDate", "createdAt", "createdBy", "customerId", "deletedAt", "deletedBy", "expectedReturnDate", "id", "notes", "rentalDate", "rentalNumber", "reservationId", "status", "updatedAt", "updatedBy" FROM "Rental";
DROP TABLE "Rental";
ALTER TABLE "new_Rental" RENAME TO "Rental";
CREATE UNIQUE INDEX "Rental_rentalNumber_key" ON "Rental"("rentalNumber");
CREATE UNIQUE INDEX "Rental_reservationId_key" ON "Rental"("reservationId");
CREATE INDEX "Rental_customerId_idx" ON "Rental"("customerId");
CREATE INDEX "Rental_reservationId_idx" ON "Rental"("reservationId");
CREATE INDEX "Rental_rentalNumber_idx" ON "Rental"("rentalNumber");
CREATE INDEX "Rental_status_idx" ON "Rental"("status");
CREATE INDEX "Rental_rentalDate_idx" ON "Rental"("rentalDate");
CREATE INDEX "Rental_expectedReturnDate_idx" ON "Rental"("expectedReturnDate");
CREATE INDEX "Rental_actualReturnDate_idx" ON "Rental"("actualReturnDate");
CREATE INDEX "Rental_deletedAt_idx" ON "Rental"("deletedAt");
CREATE INDEX "Rental_createdAt_idx" ON "Rental"("createdAt");
CREATE INDEX "Rental_status_deletedAt_idx" ON "Rental"("status", "deletedAt");
CREATE TABLE "new_RentalSettlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementNumber" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'rental',
    "entityId" TEXT NOT NULL,
    "rentalId" TEXT,
    "saleId" TEXT,
    "accountId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "chargeFils" INTEGER NOT NULL DEFAULT 0,
    "depositFils" INTEGER NOT NULL DEFAULT 0,
    "lateFeeFils" INTEGER NOT NULL DEFAULT 0,
    "adjustmentFils" INTEGER NOT NULL DEFAULT 0,
    "discountFils" INTEGER NOT NULL DEFAULT 0,
    "refundFils" INTEGER NOT NULL DEFAULT 0,
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
    CONSTRAINT "RentalSettlement_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RentalSettlement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RentalSettlement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RentalSettlement" ("accountId", "adjustmentFils", "cancelledAt", "chargeFils", "closedAt", "createdAt", "createdBy", "currency", "customerId", "deletedAt", "deletedBy", "depositFils", "discountFils", "entityId", "entityType", "id", "lateFeeFils", "notes", "paidFils", "refundFils", "remainingFils", "rentalId", "saleId", "settlementNumber", "status", "totalFils", "updatedAt", "updatedBy") SELECT "accountId", "adjustmentFils", "cancelledAt", "chargeFils", "closedAt", "createdAt", "createdBy", "currency", "customerId", "deletedAt", "deletedBy", "depositFils", "discountFils", "rentalId", 'rental', "id", "lateFeeFils", "notes", "paidFils", "refundFils", "remainingFils", "rentalId", NULL, "settlementNumber", "status", "totalFils", "updatedAt", "updatedBy" FROM "RentalSettlement";
DROP TABLE "RentalSettlement";
ALTER TABLE "new_RentalSettlement" RENAME TO "RentalSettlement";
CREATE UNIQUE INDEX "RentalSettlement_settlementNumber_key" ON "RentalSettlement"("settlementNumber");
CREATE UNIQUE INDEX "RentalSettlement_rentalId_key" ON "RentalSettlement"("rentalId");
CREATE UNIQUE INDEX "RentalSettlement_saleId_key" ON "RentalSettlement"("saleId");
CREATE INDEX "RentalSettlement_settlementNumber_idx" ON "RentalSettlement"("settlementNumber");
CREATE INDEX "RentalSettlement_entityType_entityId_idx" ON "RentalSettlement"("entityType", "entityId");
CREATE INDEX "RentalSettlement_rentalId_idx" ON "RentalSettlement"("rentalId");
CREATE INDEX "RentalSettlement_saleId_idx" ON "RentalSettlement"("saleId");
CREATE INDEX "RentalSettlement_accountId_idx" ON "RentalSettlement"("accountId");
CREATE INDEX "RentalSettlement_customerId_idx" ON "RentalSettlement"("customerId");
CREATE INDEX "RentalSettlement_status_idx" ON "RentalSettlement"("status");
CREATE INDEX "RentalSettlement_deletedAt_idx" ON "RentalSettlement"("deletedAt");
CREATE INDEX "RentalSettlement_createdAt_idx" ON "RentalSettlement"("createdAt");
CREATE INDEX "RentalSettlement_status_deletedAt_idx" ON "RentalSettlement"("status", "deletedAt");
CREATE UNIQUE INDEX "RentalSettlement_entityType_entityId_key" ON "RentalSettlement"("entityType", "entityId");
CREATE TABLE "new_SettlementHistory" (
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
    CONSTRAINT "SettlementHistory_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RentalSettlement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SettlementHistory_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SettlementHistory" ("action", "amountFils", "createdAt", "id", "newStatus", "oldStatus", "paymentId", "reason", "settlementId", "userId", "username") SELECT "action", "amountFils", "createdAt", "id", "newStatus", "oldStatus", "paymentId", "reason", "settlementId", "userId", "username" FROM "SettlementHistory";
DROP TABLE "SettlementHistory";
ALTER TABLE "new_SettlementHistory" RENAME TO "SettlementHistory";
CREATE INDEX "SettlementHistory_settlementId_idx" ON "SettlementHistory"("settlementId");
CREATE INDEX "SettlementHistory_action_idx" ON "SettlementHistory"("action");
CREATE INDEX "SettlementHistory_paymentId_idx" ON "SettlementHistory"("paymentId");
CREATE INDEX "SettlementHistory_newStatus_idx" ON "SettlementHistory"("newStatus");
CREATE INDEX "SettlementHistory_createdAt_idx" ON "SettlementHistory"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_saleNumber_key" ON "Sale"("saleNumber");

-- CreateIndex
CREATE INDEX "Sale_saleNumber_idx" ON "Sale"("saleNumber");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateIndex
CREATE INDEX "Sale_deletedAt_idx" ON "Sale"("deletedAt");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "Sale_completedAt_idx" ON "Sale"("completedAt");

-- CreateIndex
CREATE INDEX "Sale_status_deletedAt_idx" ON "Sale"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_itemId_idx" ON "SaleItem"("itemId");

-- CreateIndex
CREATE INDEX "SaleItem_barcodeSnapshot_idx" ON "SaleItem"("barcodeSnapshot");

-- CreateIndex
CREATE UNIQUE INDEX "SaleItem_saleId_itemId_key" ON "SaleItem"("saleId", "itemId");

-- CreateIndex
CREATE INDEX "SaleHistory_saleId_idx" ON "SaleHistory"("saleId");

-- CreateIndex
CREATE INDEX "SaleHistory_action_idx" ON "SaleHistory"("action");

-- CreateIndex
CREATE INDEX "SaleHistory_newStatus_idx" ON "SaleHistory"("newStatus");

-- CreateIndex
CREATE INDEX "SaleHistory_createdAt_idx" ON "SaleHistory"("createdAt");

