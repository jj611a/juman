import type { ItemWithRelations } from '../inventory.types';

export function toItemPublic(row: ItemWithRelations) {
  return {
    id: row.id,
    internalCode: row.internalCode,
    displayName: row.displayName,
    purchasePrice: row.purchasePrice,
    rentalPrice: row.rentalPrice,
    salePrice: row.salePrice,
    condition: row.condition,
    status: row.status,
    lifecycleState: row.lifecycleState,
    description: row.description,
    category: summary(row.category),
    brand: summary(row.brand),
    color: row.color
      ? { ...summary(row.color), hexCode: row.color.hexCode }
      : null,
    size: summary(row.size),
    barcodes: row.barcodes.map((x) => ({
      id: x.id,
      value: x.barcode.code,
      isPrimary: x.isPrimary,
    })),
    media: (row.media ?? []).map((x) => ({
      id: x.id,
      mediaFileId: x.mediaFileId,
      purpose: x.purpose,
      isPrimary: x.isPrimary,
      displayOrder: x.displayOrder,
      mediaFile: {
        id: x.mediaFile.id,
        originalFilename: x.mediaFile.originalFilename,
        mimeType: x.mediaFile.mimeType,
        relativePath: x.mediaFile.relativePath,
      },
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}
function summary(x: { id: string; name: string } | null) {
  return x ? { id: x.id, name: x.name } : null;
}
