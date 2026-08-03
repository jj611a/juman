import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  FINANCIAL_TX_STATUS,
  FINANCIAL_TX_TYPE,
  PAYMENT_STATUS,
} from '../finance/finance.constants';
import { SETTLEMENT_STATUS } from '../finance/settlement/settlement.constants';
import { ITEM_LIFECYCLE } from '../inventory/inventory.constants';
import { RENTAL_STATUS } from '../rentals/rentals.constants';

export type DateRange = { from?: Date; to?: Date };

/**
 * Read-only Prisma aggregates for reports.
 * This repository MUST NOT call create/update/delete on domain tables.
 */
@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Expose for tests — never used for writes by ReportsService. */
  get client() {
    return this.prisma;
  }

  private dayBounds(d = new Date()) {
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private monthBounds(d = new Date()) {
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  async dashboardSummary() {
    const { start: todayStart, end: todayEnd } = this.dayBounds();
    const { start: monthStart, end: monthEnd } = this.monthBounds();

    const [
      activeRentals,
      todaysCheckouts,
      todaysReturns,
      openSettlements,
      outstanding,
      revenueToday,
      revenueMonth,
      inventoryCount,
      reservedItems,
      availableItems,
    ] = await Promise.all([
      this.prisma.rental.count({
        where: {
          deletedAt: null,
          status: {
            in: [
              RENTAL_STATUS.CHECKED_OUT,
              RENTAL_STATUS.ACTIVE,
              RENTAL_STATUS.RETURN_PENDING,
              RENTAL_STATUS.OVERDUE,
            ],
          },
        },
      }),
      this.prisma.rental.count({
        where: {
          deletedAt: null,
          status: { not: RENTAL_STATUS.DRAFT },
          rentalDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.rental.count({
        where: {
          deletedAt: null,
          actualReturnDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.rentalSettlement.count({
        where: {
          deletedAt: null,
          status: {
            in: [SETTLEMENT_STATUS.OPEN, SETTLEMENT_STATUS.PARTIALLY_PAID],
          },
        },
      }),
      this.prisma.rentalSettlement.aggregate({
        where: {
          deletedAt: null,
          status: {
            in: [SETTLEMENT_STATUS.OPEN, SETTLEMENT_STATUS.PARTIALLY_PAID],
          },
        },
        _sum: { remainingFils: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          deletedAt: null,
          status: PAYMENT_STATUS.COMPLETED,
          completedAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { amountFils: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          deletedAt: null,
          status: PAYMENT_STATUS.COMPLETED,
          completedAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amountFils: true },
      }),
      this.prisma.item.count({ where: { deletedAt: null } }),
      this.prisma.item.count({
        where: { deletedAt: null, lifecycleState: ITEM_LIFECYCLE.RESERVED },
      }),
      this.prisma.item.count({
        where: { deletedAt: null, lifecycleState: ITEM_LIFECYCLE.AVAILABLE },
      }),
    ]);

    return {
      activeRentals,
      todaysCheckouts,
      todaysReturns,
      openSettlements,
      outstandingBalanceFils: outstanding._sum.remainingFils ?? 0,
      revenueTodayFils: revenueToday._sum.amountFils ?? 0,
      revenueThisMonthFils: revenueMonth._sum.amountFils ?? 0,
      inventoryCount,
      reservedItems,
      availableItems,
      asOf: new Date().toISOString(),
    };
  }

  async financialSummary(range: DateRange) {
    const paymentWhere: Prisma.PaymentWhereInput = {
      deletedAt: null,
      status: PAYMENT_STATUS.COMPLETED,
    };
    if (range.from || range.to) {
      paymentWhere.completedAt = {};
      if (range.from) paymentWhere.completedAt.gte = range.from;
      if (range.to) paymentWhere.completedAt.lte = range.to;
    }

    const txWhere = (type: string): Prisma.FinancialTransactionWhereInput => {
      const w: Prisma.FinancialTransactionWhereInput = {
        status: FINANCIAL_TX_STATUS.POSTED,
        type,
      };
      if (range.from || range.to) {
        w.createdAt = {};
        if (range.from) w.createdAt.gte = range.from;
        if (range.to) w.createdAt.lte = range.to;
      }
      return w;
    };

    const settlementWhere: Prisma.RentalSettlementWhereInput = {
      deletedAt: null,
      status: {
        in: [SETTLEMENT_STATUS.OPEN, SETTLEMENT_STATUS.PARTIALLY_PAID],
      },
    };
    if (range.from || range.to) {
      settlementWhere.createdAt = {};
      if (range.from) settlementWhere.createdAt.gte = range.from;
      if (range.to) settlementWhere.createdAt.lte = range.to;
    }

    const [
      payments,
      outstanding,
      refunds,
      discounts,
      lateFees,
      adjustments,
      deposits,
      charges,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amountFils: true },
        _count: true,
      }),
      this.prisma.rentalSettlement.aggregate({
        where: {
          deletedAt: null,
          status: {
            in: [SETTLEMENT_STATUS.OPEN, SETTLEMENT_STATUS.PARTIALLY_PAID],
          },
        },
        _sum: { remainingFils: true },
        _count: true,
      }),
      this.prisma.financialTransaction.aggregate({
        where: txWhere(FINANCIAL_TX_TYPE.REFUND),
        _sum: { amountFils: true },
        _count: true,
      }),
      this.prisma.financialTransaction.aggregate({
        where: txWhere(FINANCIAL_TX_TYPE.DISCOUNT),
        _sum: { amountFils: true },
        _count: true,
      }),
      this.prisma.financialTransaction.aggregate({
        where: txWhere(FINANCIAL_TX_TYPE.LATE_FEE),
        _sum: { amountFils: true },
        _count: true,
      }),
      this.prisma.financialTransaction.aggregate({
        where: txWhere(FINANCIAL_TX_TYPE.ADJUSTMENT),
        _sum: { amountFils: true },
        _count: true,
      }),
      this.prisma.financialTransaction.aggregate({
        where: txWhere(FINANCIAL_TX_TYPE.DEPOSIT),
        _sum: { amountFils: true },
        _count: true,
      }),
      this.prisma.financialTransaction.aggregate({
        where: txWhere(FINANCIAL_TX_TYPE.RENTAL_CHARGE),
        _sum: { amountFils: true },
        _count: true,
      }),
    ]);

    return {
      revenueFils: payments._sum.amountFils ?? 0,
      paymentsCount: payments._count,
      outstandingFils: outstanding._sum.remainingFils ?? 0,
      openSettlementsCount: outstanding._count,
      refundsFils: Math.abs(refunds._sum.amountFils ?? 0),
      refundsCount: refunds._count,
      discountsFils: Math.abs(discounts._sum.amountFils ?? 0),
      discountsCount: discounts._count,
      lateFeesFils: lateFees._sum.amountFils ?? 0,
      lateFeesCount: lateFees._count,
      adjustmentsFils: adjustments._sum.amountFils ?? 0,
      adjustmentsCount: adjustments._count,
      depositsFils: deposits._sum.amountFils ?? 0,
      depositsCount: deposits._count,
      chargesFils: charges._sum.amountFils ?? 0,
      chargesCount: charges._count,
    };
  }

  async listRentals(input: {
    where: Prisma.RentalWhereInput;
    orderBy: Prisma.RentalOrderByWithRelationInput;
    offset: number;
    limit: number;
  }) {
    const [rows, total] = await Promise.all([
      this.prisma.rental.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
        select: {
          id: true,
          rentalNumber: true,
          customerId: true,
          rentalDate: true,
          expectedReturnDate: true,
          actualReturnDate: true,
          status: true,
          createdBy: true,
          customer: {
            select: {
              id: true,
              customerNumber: true,
              fullName: true,
            },
          },
          settlement: {
            select: {
              id: true,
              settlementNumber: true,
              status: true,
              totalFils: true,
              remainingFils: true,
            },
          },
        },
      }),
      this.prisma.rental.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  async listReservations(input: {
    where: Prisma.ReservationWhereInput;
    orderBy: Prisma.ReservationOrderByWithRelationInput;
    offset: number;
    limit: number;
  }) {
    const [rows, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
        select: {
          id: true,
          reservationNumber: true,
          customerId: true,
          startDate: true,
          expectedCheckoutDate: true,
          expectedReturnDate: true,
          status: true,
          createdBy: true,
          customer: {
            select: {
              id: true,
              customerNumber: true,
              fullName: true,
            },
          },
        },
      }),
      this.prisma.reservation.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  async inventoryValue(where: Prisma.ItemWhereInput) {
    const agg = await this.prisma.item.aggregate({
      where,
      _sum: {
        rentalPrice: true,
        purchasePrice: true,
        salePrice: true,
      },
      _count: true,
    });
    return {
      itemCount: agg._count,
      rentalPriceSumFils: agg._sum.rentalPrice ?? 0,
      purchasePriceSumFils: agg._sum.purchasePrice ?? 0,
      salePriceSumFils: agg._sum.salePrice ?? 0,
    };
  }

  async inventoryAvailability() {
    const rows = await this.prisma.item.groupBy({
      by: ['lifecycleState'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    return rows.map((r) => ({
      lifecycleState: r.lifecycleState,
      count: r._count._all,
    }));
  }

  async inventoryGroupByTaxonomy(
    field: 'categoryId' | 'brandId' | 'colorId' | 'sizeId',
  ) {
    const rows = await this.prisma.item.groupBy({
      by: [field],
      where: { deletedAt: null, [field]: { not: null } },
      _count: { _all: true },
      _sum: { rentalPrice: true },
    });
    const ids = rows.map((r) => r[field]).filter((id): id is string => !!id);
    let labels: Record<string, string> = {};
    if (field === 'categoryId' && ids.length) {
      const cats = await this.prisma.category.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      labels = Object.fromEntries(cats.map((c) => [c.id, c.name]));
    } else if (field === 'brandId' && ids.length) {
      const brands = await this.prisma.brand.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      labels = Object.fromEntries(brands.map((b) => [b.id, b.name]));
    } else if (field === 'colorId' && ids.length) {
      const colors = await this.prisma.color.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      labels = Object.fromEntries(colors.map((c) => [c.id, c.name]));
    } else if (field === 'sizeId' && ids.length) {
      const sizes = await this.prisma.size.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      labels = Object.fromEntries(sizes.map((s) => [s.id, s.name]));
    }
    return rows.map((r) => {
      const id = r[field] as string | null;
      return {
        id,
        name: id ? labels[id] ?? null : null,
        count: r._count._all,
        rentalPriceSumFils: r._sum.rentalPrice ?? 0,
      };
    });
  }

  async listItems(input: {
    where: Prisma.ItemWhereInput;
    orderBy: Prisma.ItemOrderByWithRelationInput;
    offset: number;
    limit: number;
  }) {
    const [rows, total] = await Promise.all([
      this.prisma.item.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
        select: {
          id: true,
          internalCode: true,
          displayName: true,
          lifecycleState: true,
          status: true,
          rentalPrice: true,
          categoryId: true,
          brandId: true,
          colorId: true,
          sizeId: true,
        },
      }),
      this.prisma.item.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  async customerOutstanding(customerId: string) {
    const agg = await this.prisma.rentalSettlement.aggregate({
      where: {
        customerId,
        deletedAt: null,
        status: {
          in: [SETTLEMENT_STATUS.OPEN, SETTLEMENT_STATUS.PARTIALLY_PAID],
        },
      },
      _sum: { remainingFils: true, totalFils: true, paidFils: true },
      _count: true,
    });
    return {
      customerId,
      openSettlementsCount: agg._count,
      outstandingFils: agg._sum.remainingFils ?? 0,
      totalFils: agg._sum.totalFils ?? 0,
      paidFils: agg._sum.paidFils ?? 0,
    };
  }

  async listPayments(input: {
    where: Prisma.PaymentWhereInput;
    orderBy: Prisma.PaymentOrderByWithRelationInput;
    offset: number;
    limit: number;
  }) {
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
        select: {
          id: true,
          paymentNumber: true,
          accountId: true,
          settlementId: true,
          amountFils: true,
          status: true,
          method: true,
          completedAt: true,
          createdAt: true,
          account: {
            select: { customerId: true, accountNumber: true },
          },
        },
      }),
      this.prisma.payment.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  findCustomer(id: string) {
    return this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        customerNumber: true,
        fullName: true,
        status: true,
        phone: true,
      },
    });
  }
}
