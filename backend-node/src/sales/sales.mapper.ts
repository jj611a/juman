import type { SaleWithRelations } from './sales.repository';
import { Money } from '../finance/money/money.value';

export function toSalePublic(row: SaleWithRelations) {
  return {
    id: row.id,
    saleNumber: row.saleNumber,
    customerId: row.customerId,
    customer: row.customer
      ? {
          id: row.customer.id,
          customerNumber: row.customer.customerNumber,
          fullName: row.customer.fullName,
          phone: row.customer.phone,
        }
      : null,
    status: row.status,
    subtotalFils: row.subtotalFils,
    discountFils: row.discountFils,
    taxFils: row.taxFils,
    totalFils: row.totalFils,
    subtotalMajor: Money.ofFils(row.subtotalFils).toMajorString(),
    totalMajor: Money.ofFils(row.totalFils).toMajorString(),
    notes: row.notes,
    completedAt: row.completedAt,
    items: row.items.map((i) => ({
      id: i.id,
      itemId: i.itemId,
      priceFils: i.priceFils,
      discountFils: i.discountFils,
      quantity: i.quantity,
      totalFils: i.totalFils,
      barcodeSnapshot: i.barcodeSnapshot,
      itemNameSnapshot: i.itemNameSnapshot,
      item: i.item
        ? {
            id: i.item.id,
            internalCode: i.item.internalCode,
            displayName: i.item.displayName,
            status: i.item.status,
            lifecycleState: i.item.lifecycleState,
            salePrice: i.item.salePrice,
          }
        : null,
    })),
    settlement: row.settlement
      ? {
          id: row.settlement.id,
          settlementNumber: row.settlement.settlementNumber,
          status: row.settlement.status,
          totalFils: row.settlement.totalFils,
          paidFils: row.settlement.paidFils,
          remainingFils: row.settlement.remainingFils,
          customerId: row.settlement.customerId,
          accountId: row.settlement.accountId,
        }
      : null,
    history: row.history.map((h) => ({
      id: h.id,
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      action: h.action,
      reason: h.reason,
      userId: h.userId,
      username: h.username,
      createdAt: h.createdAt,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  };
}

export type SalePublic = ReturnType<typeof toSalePublic>;

export function toSaleSnapshot(row: {
  id: string;
  saleNumber: string;
  status: string;
  totalFils: number;
  customerId?: string | null;
}) {
  return {
    id: row.id,
    saleNumber: row.saleNumber,
    status: row.status,
    totalFils: row.totalFils,
    customerId: row.customerId ?? null,
  };
}
