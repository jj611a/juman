-- Phase 5.1: rental workflow core

CREATE TABLE "Rental" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rentalNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
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
    CONSTRAINT "Rental_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Rental_rentalNumber_key" ON "Rental"("rentalNumber");
CREATE INDEX "Rental_customerId_idx" ON "Rental"("customerId");
CREATE INDEX "Rental_rentalNumber_idx" ON "Rental"("rentalNumber");
CREATE INDEX "Rental_status_idx" ON "Rental"("status");
CREATE INDEX "Rental_rentalDate_idx" ON "Rental"("rentalDate");
CREATE INDEX "Rental_expectedReturnDate_idx" ON "Rental"("expectedReturnDate");
CREATE INDEX "Rental_deletedAt_idx" ON "Rental"("deletedAt");
CREATE INDEX "Rental_createdAt_idx" ON "Rental"("createdAt");
CREATE INDEX "Rental_status_deletedAt_idx" ON "Rental"("status", "deletedAt");

CREATE TABLE "RentalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rentalId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "barcodeValue" TEXT,
    "agreedRentalPrice" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "RentalItem_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RentalItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RentalItem_rentalId_itemId_key" ON "RentalItem"("rentalId", "itemId");
CREATE INDEX "RentalItem_rentalId_idx" ON "RentalItem"("rentalId");
CREATE INDEX "RentalItem_itemId_idx" ON "RentalItem"("itemId");
CREATE INDEX "RentalItem_barcodeValue_idx" ON "RentalItem"("barcodeValue");

CREATE TABLE "RentalStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rentalId" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalStatusHistory_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "RentalStatusHistory_rentalId_idx" ON "RentalStatusHistory"("rentalId");
CREATE INDEX "RentalStatusHistory_newStatus_idx" ON "RentalStatusHistory"("newStatus");
CREATE INDEX "RentalStatusHistory_createdAt_idx" ON "RentalStatusHistory"("createdAt");
