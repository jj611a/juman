-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "secondaryPhone" TEXT,
    "secondaryPhoneNormalized" TEXT,
    "address" TEXT,
    "city" TEXT,
    "nationalId" TEXT,
    "gender" TEXT,
    "birthDate" DATETIME,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerNumber_key" ON "Customer"("customerNumber");
CREATE INDEX "Customer_fullName_idx" ON "Customer"("fullName");
CREATE INDEX "Customer_phoneNormalized_idx" ON "Customer"("phoneNormalized");
CREATE INDEX "Customer_secondaryPhoneNormalized_idx" ON "Customer"("secondaryPhoneNormalized");
CREATE INDEX "Customer_nationalId_idx" ON "Customer"("nationalId");
CREATE INDEX "Customer_city_idx" ON "Customer"("city");
CREATE INDEX "Customer_status_idx" ON "Customer"("status");
CREATE INDEX "Customer_deletedAt_idx" ON "Customer"("deletedAt");
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");
CREATE INDEX "Customer_updatedAt_idx" ON "Customer"("updatedAt");
CREATE INDEX "Customer_status_phoneNormalized_deletedAt_idx" ON "Customer"("status", "phoneNormalized", "deletedAt");