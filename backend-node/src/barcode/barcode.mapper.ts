import type { Barcode } from '@prisma/client';

export interface BarcodePublic {
  readonly id: string;
  readonly value: string;
  readonly type: string;
  readonly prefix: string;
  readonly status: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly reservedAt: Date | null;
  readonly activatedAt: Date | null;
  readonly retiredAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
}

export function toPublicBarcode(row: Barcode): BarcodePublic {
  return {
    id: row.id,
    value: row.code,
    type: row.type,
    prefix: row.prefix,
    status: row.status,
    entityType: row.entityType,
    entityId: row.entityId,
    reservedAt: row.reservedAt,
    activatedAt: row.activatedAt,
    retiredAt: row.retiredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
  };
}
