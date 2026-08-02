import { Money } from './money/money.value';
import { outstandingDeltaFils } from './finance.constants';
import type {
  FinancialAccount,
  FinancialTransaction,
  Payment,
} from '@prisma/client';
import type { AccountWithCustomer } from './finance.repository';

export function toAccountPublic(
  row: AccountWithCustomer,
  outstandingFils?: number,
) {
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    customerId: row.customerId,
    customer: row.customer
      ? {
          id: row.customer.id,
          customerNumber: row.customer.customerNumber,
          fullName: row.customer.fullName,
          status: row.customer.status,
        }
      : null,
    currency: row.currency,
    status: row.status,
    notes: row.notes,
    outstandingFils: outstandingFils ?? null,
    outstandingMajor: outstandingFils != null
      ? Money.ofFils(outstandingFils).toMajorString()
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export function toTransactionPublic(row: FinancialTransaction) {
  return {
    id: row.id,
    accountId: row.accountId,
    type: row.type,
    amountFils: row.amountFils,
    amountMajor: Money.ofFils(row.amountFils).toMajorString(),
    status: row.status,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    description: row.description,
    outstandingDeltaFils: outstandingDeltaFils(row.type, row.amountFils),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
  };
}

export function toPaymentPublic(row: Payment) {
  return {
    id: row.id,
    paymentNumber: row.paymentNumber,
    accountId: row.accountId,
    transactionId: row.transactionId,
    amountFils: row.amountFils,
    amountMajor: Money.ofFils(row.amountFils).toMajorString(),
    status: row.status,
    method: row.method,
    notes: row.notes,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
  };
}

export function computeOutstandingFils(
  rows: Array<Pick<FinancialTransaction, 'type' | 'amountFils' | 'status'>>,
): number {
  let total = 0;
  for (const row of rows) {
    if (row.status !== 'posted') continue;
    total += outstandingDeltaFils(row.type, row.amountFils);
  }
  return total;
}

export function toAccountSnapshot(row: FinancialAccount) {
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    customerId: row.customerId,
    status: row.status,
    currency: row.currency,
  };
}
