import type { SettlementWithRelations } from './settlement.repository';
import { Money } from '../money/money.value';

export function toSettlementPublic(row: SettlementWithRelations) {
  return {
    id: row.id,
    settlementNumber: row.settlementNumber,
    rentalId: row.rentalId,
    rental: row.rental
      ? {
          id: row.rental.id,
          rentalNumber: row.rental.rentalNumber,
          status: row.rental.status,
        }
      : null,
    accountId: row.accountId,
    account: row.account
      ? {
          id: row.account.id,
          accountNumber: row.account.accountNumber,
          status: row.account.status,
        }
      : null,
    customerId: row.customerId,
    totalFils: row.totalFils,
    paidFils: row.paidFils,
    remainingFils: row.remainingFils,
    totalMajor: Money.ofFils(row.totalFils).toMajorString(),
    paidMajor: Money.ofFils(row.paidFils).toMajorString(),
    remainingMajor: Money.ofFils(row.remainingFils).toMajorString(),
    status: row.status,
    currency: row.currency,
    notes: row.notes,
    closedAt: row.closedAt,
    cancelledAt: row.cancelledAt,
    history: row.history.map((h) => ({
      id: h.id,
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      action: h.action,
      amountFils: h.amountFils,
      paymentId: h.paymentId,
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

export function toSettlementSnapshot(row: {
  id: string;
  settlementNumber: string;
  rentalId: string;
  status: string;
  totalFils: number;
  paidFils: number;
  remainingFils: number;
}) {
  return {
    id: row.id,
    settlementNumber: row.settlementNumber,
    rentalId: row.rentalId,
    status: row.status,
    totalFils: row.totalFils,
    paidFils: row.paidFils,
    remainingFils: row.remainingFils,
  };
}
