-- Phase 4.1 Inventory Catalog Engine
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT
);

CREATE TABLE "Color" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "hexCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT
);

CREATE TABLE "Size" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT
);

CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "internalCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "categoryId" TEXT,
    "brandId" TEXT,
    "colorId" TEXT,
    "sizeId" TEXT,
    "purchasePrice" INTEGER NOT NULL DEFAULT 0,
    "rentalPrice" INTEGER NOT NULL DEFAULT 0,
    "salePrice" INTEGER NOT NULL DEFAULT 0,
    "condition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,
    CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ItemMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "mediaFileId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'gallery',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "ItemMedia_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemMedia_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "MediaFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ItemBarcode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "barcodeId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "ItemBarcode_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemBarcode_barcodeId_fkey" FOREIGN KEY ("barcodeId") REFERENCES "Barcode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Item_internalCode_key" ON "Item"("internalCode");
CREATE UNIQUE INDEX "ItemBarcode_barcodeId_key" ON "ItemBarcode"("barcodeId");
CREATE UNIQUE INDEX "ItemMedia_itemId_mediaFileId_purpose_key" ON "ItemMedia"("itemId", "mediaFileId", "purpose");

CREATE INDEX "Category_name_idx" ON "Category"("name");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");
CREATE INDEX "Category_deletedAt_idx" ON "Category"("deletedAt");
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");
CREATE INDEX "Brand_name_idx" ON "Brand"("name");
CREATE INDEX "Brand_isActive_idx" ON "Brand"("isActive");
CREATE INDEX "Brand_deletedAt_idx" ON "Brand"("deletedAt");
CREATE INDEX "Color_name_idx" ON "Color"("name");
CREATE INDEX "Color_hexCode_idx" ON "Color"("hexCode");
CREATE INDEX "Color_isActive_idx" ON "Color"("isActive");
CREATE INDEX "Color_deletedAt_idx" ON "Color"("deletedAt");
CREATE INDEX "Size_name_idx" ON "Size"("name");
CREATE INDEX "Size_sortOrder_idx" ON "Size"("sortOrder");
CREATE INDEX "Size_isActive_idx" ON "Size"("isActive");
CREATE INDEX "Size_deletedAt_idx" ON "Size"("deletedAt");
CREATE INDEX "Item_displayName_idx" ON "Item"("displayName");
CREATE INDEX "Item_internalCode_idx" ON "Item"("internalCode");
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");
CREATE INDEX "Item_brandId_idx" ON "Item"("brandId");
CREATE INDEX "Item_colorId_idx" ON "Item"("colorId");
CREATE INDEX "Item_sizeId_idx" ON "Item"("sizeId");
CREATE INDEX "Item_status_idx" ON "Item"("status");
CREATE INDEX "Item_condition_idx" ON "Item"("condition");
CREATE INDEX "Item_deletedAt_idx" ON "Item"("deletedAt");
CREATE INDEX "Item_createdAt_idx" ON "Item"("createdAt");
CREATE INDEX "Item_updatedAt_idx" ON "Item"("updatedAt");
CREATE INDEX "Item_status_deletedAt_idx" ON "Item"("status", "deletedAt");
CREATE INDEX "ItemMedia_itemId_idx" ON "ItemMedia"("itemId");
CREATE INDEX "ItemMedia_mediaFileId_idx" ON "ItemMedia"("mediaFileId");
CREATE INDEX "ItemMedia_purpose_idx" ON "ItemMedia"("purpose");
CREATE INDEX "ItemMedia_deletedAt_idx" ON "ItemMedia"("deletedAt");
CREATE INDEX "ItemBarcode_itemId_idx" ON "ItemBarcode"("itemId");
CREATE INDEX "ItemBarcode_barcodeId_idx" ON "ItemBarcode"("barcodeId");
CREATE INDEX "ItemBarcode_deletedAt_idx" ON "ItemBarcode"("deletedAt");

CREATE UNIQUE INDEX "Category_live_name_ci_key" ON "Category"(lower("name")) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Brand_live_name_ci_key" ON "Brand"(lower("name")) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Color_live_name_ci_key" ON "Color"(lower("name")) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Size_live_name_ci_key" ON "Size"(lower("name")) WHERE "deletedAt" IS NULL;
