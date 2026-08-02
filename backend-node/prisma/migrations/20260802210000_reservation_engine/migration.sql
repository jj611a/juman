-- Phase 5.2: reservation engine

ALTER TABLE "Rental" ADD COLUMN "reservationId" TEXT;
CREATE UNIQUE INDEX "Rental_reservationId_key" ON "Rental"("reservationId");
CREATE INDEX "Rental_reservationId_idx" ON "Rental"("reservationId");

CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "expectedCheckoutDate" DATETIME NOT NULL,
    "expectedReturnDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,
    CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Reservation_reservationNumber_key" ON "Reservation"("reservationNumber");
CREATE INDEX "Reservation_customerId_idx" ON "Reservation"("customerId");
CREATE INDEX "Reservation_reservationNumber_idx" ON "Reservation"("reservationNumber");
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");
CREATE INDEX "Reservation_startDate_idx" ON "Reservation"("startDate");
CREATE INDEX "Reservation_expectedCheckoutDate_idx" ON "Reservation"("expectedCheckoutDate");
CREATE INDEX "Reservation_expectedReturnDate_idx" ON "Reservation"("expectedReturnDate");
CREATE INDEX "Reservation_deletedAt_idx" ON "Reservation"("deletedAt");
CREATE INDEX "Reservation_createdAt_idx" ON "Reservation"("createdAt");
CREATE INDEX "Reservation_status_deletedAt_idx" ON "Reservation"("status", "deletedAt");
CREATE INDEX "Reservation_startDate_expectedReturnDate_idx" ON "Reservation"("startDate", "expectedReturnDate");

CREATE TABLE "ReservationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "barcodeValue" TEXT,
    "agreedRentalPrice" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "ReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReservationItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReservationItem_reservationId_itemId_key" ON "ReservationItem"("reservationId", "itemId");
CREATE INDEX "ReservationItem_reservationId_idx" ON "ReservationItem"("reservationId");
CREATE INDEX "ReservationItem_itemId_idx" ON "ReservationItem"("itemId");
CREATE INDEX "ReservationItem_barcodeValue_idx" ON "ReservationItem"("barcodeValue");

CREATE TABLE "ReservationStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "username" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationStatusHistory_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ReservationStatusHistory_reservationId_idx" ON "ReservationStatusHistory"("reservationId");
CREATE INDEX "ReservationStatusHistory_newStatus_idx" ON "ReservationStatusHistory"("newStatus");
CREATE INDEX "ReservationStatusHistory_createdAt_idx" ON "ReservationStatusHistory"("createdAt");
