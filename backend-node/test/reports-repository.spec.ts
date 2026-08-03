import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsRepository } from '../src/reports/reports.repository';
import { ITEM_LIFECYCLE } from '../src/inventory/inventory.constants';
import { RENTAL_STATUS } from '../src/rentals/rentals.constants';
import { PAYMENT_STATUS } from '../src/finance/finance.constants';

describe('ReportsRepository', () => {
  const prisma = {
    rental: { count: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    rentalSettlement: { count: vi.fn(), aggregate: vi.fn() },
    payment: { aggregate: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    item: {
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    financialTransaction: { aggregate: vi.fn() },
    reservation: { findMany: vi.fn(), count: vi.fn() },
    category: { findMany: vi.fn() },
    brand: { findMany: vi.fn() },
    color: { findMany: vi.fn() },
    size: { findMany: vi.fn() },
    customer: { findFirst: vi.fn() },
  };

  let repo: ReportsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ReportsRepository(prisma as never);
    expect(repo.client).toBe(prisma);
  });

  it('aggregates dashboard summary without N+1 loops', async () => {
    prisma.rental.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    prisma.rentalSettlement.count.mockResolvedValue(3);
    prisma.rentalSettlement.aggregate.mockResolvedValue({
      _sum: { remainingFils: 9000 },
    });
    prisma.payment.aggregate
      .mockResolvedValueOnce({ _sum: { amountFils: 1000 } })
      .mockResolvedValueOnce({ _sum: { amountFils: 5000 } });
    prisma.item.count
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(10);

    const summary = await repo.dashboardSummary();
    expect(summary.activeRentals).toBe(4);
    expect(summary.todaysCheckouts).toBe(1);
    expect(summary.todaysReturns).toBe(2);
    expect(summary.openSettlements).toBe(3);
    expect(summary.outstandingBalanceFils).toBe(9000);
    expect(summary.revenueTodayFils).toBe(1000);
    expect(summary.revenueThisMonthFils).toBe(5000);
    expect(summary.inventoryCount).toBe(20);
    expect(summary.reservedItems).toBe(5);
    expect(summary.availableItems).toBe(10);
    expect(summary.asOf).toBeTruthy();
  });

  it('aggregates financial summary with date range', async () => {
    const agg = {
      _sum: { amountFils: -100 },
      _count: 2,
    };
    prisma.payment.aggregate.mockResolvedValue({
      _sum: { amountFils: 7000 },
      _count: 4,
    });
    prisma.rentalSettlement.aggregate.mockResolvedValue({
      _sum: { remainingFils: 3000 },
      _count: 1,
    });
    prisma.financialTransaction.aggregate.mockResolvedValue(agg);

    const out = await repo.financialSummary({
      from: new Date('2026-08-01'),
      to: new Date('2026-08-31'),
    });
    expect(out.revenueFils).toBe(7000);
    expect(out.paymentsCount).toBe(4);
    expect(out.outstandingFils).toBe(3000);
    expect(out.refundsFils).toBe(100);
    expect(out.discountsFils).toBe(100);
  });

  it('lists rentals/reservations/items/payments and taxonomy groups', async () => {
    prisma.rental.findMany.mockResolvedValue([{ id: 'r1' }]);
    prisma.rental.count.mockResolvedValue(1);
    await expect(
      repo.listRentals({
        where: { deletedAt: null, status: RENTAL_STATUS.ACTIVE },
        orderBy: { rentalDate: 'desc' },
        offset: 0,
        limit: 10,
      }),
    ).resolves.toEqual({ rows: [{ id: 'r1' }], total: 1 });

    prisma.reservation.findMany.mockResolvedValue([{ id: 'res1' }]);
    prisma.reservation.count.mockResolvedValue(1);
    await expect(
      repo.listReservations({
        where: { deletedAt: null },
        orderBy: { startDate: 'desc' },
        offset: 0,
        limit: 5,
      }),
    ).resolves.toEqual({ rows: [{ id: 'res1' }], total: 1 });

    prisma.item.aggregate.mockResolvedValue({
      _sum: { rentalPrice: 10, purchasePrice: 20, salePrice: 30 },
      _count: 2,
    });
    await expect(repo.inventoryValue({ deletedAt: null })).resolves.toEqual({
      itemCount: 2,
      rentalPriceSumFils: 10,
      purchasePriceSumFils: 20,
      salePriceSumFils: 30,
    });

    prisma.item.groupBy.mockResolvedValue([
      { lifecycleState: ITEM_LIFECYCLE.AVAILABLE, _count: { _all: 3 } },
    ]);
    await expect(repo.inventoryAvailability()).resolves.toEqual([
      { lifecycleState: 'available', count: 3 },
    ]);

    prisma.item.groupBy.mockResolvedValue([
      {
        categoryId: 'cat1',
        _count: { _all: 2 },
        _sum: { rentalPrice: 50 },
      },
    ]);
    prisma.category.findMany.mockResolvedValue([
      { id: 'cat1', name: 'Dresses' },
    ]);
    await expect(repo.inventoryGroupByTaxonomy('categoryId')).resolves.toEqual([
      {
        id: 'cat1',
        name: 'Dresses',
        count: 2,
        rentalPriceSumFils: 50,
      },
    ]);

    prisma.item.groupBy.mockResolvedValue([
      { brandId: 'b1', _count: { _all: 1 }, _sum: { rentalPrice: 1 } },
    ]);
    prisma.brand.findMany.mockResolvedValue([{ id: 'b1', name: 'Brand' }]);
    await repo.inventoryGroupByTaxonomy('brandId');

    prisma.item.groupBy.mockResolvedValue([
      { colorId: 'c1', _count: { _all: 1 }, _sum: { rentalPrice: 1 } },
    ]);
    prisma.color.findMany.mockResolvedValue([{ id: 'c1', name: 'Red' }]);
    await repo.inventoryGroupByTaxonomy('colorId');

    prisma.item.groupBy.mockResolvedValue([
      { sizeId: 's1', _count: { _all: 1 }, _sum: { rentalPrice: 1 } },
    ]);
    prisma.size.findMany.mockResolvedValue([{ id: 's1', name: 'M' }]);
    await repo.inventoryGroupByTaxonomy('sizeId');

    prisma.item.findMany.mockResolvedValue([{ id: 'i1' }]);
    prisma.item.count.mockResolvedValue(1);
    await repo.listItems({
      where: { deletedAt: null },
      orderBy: { internalCode: 'asc' },
      offset: 0,
      limit: 10,
    });

    prisma.rentalSettlement.aggregate.mockResolvedValue({
      _sum: { remainingFils: 100, totalFils: 200, paidFils: 100 },
      _count: 1,
    });
    await expect(repo.customerOutstanding('c1')).resolves.toMatchObject({
      outstandingFils: 100,
    });

    prisma.payment.findMany.mockResolvedValue([
      { id: 'p1', status: PAYMENT_STATUS.COMPLETED },
    ]);
    prisma.payment.count.mockResolvedValue(1);
    await repo.listPayments({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      offset: 0,
      limit: 10,
    });

    prisma.customer.findFirst.mockResolvedValue({ id: 'c1' });
    await expect(repo.findCustomer('c1')).resolves.toEqual({ id: 'c1' });
  });

  it('handles null aggregate sums and empty taxonomy labels', async () => {
    prisma.payment.aggregate.mockResolvedValue({
      _sum: { amountFils: null },
      _count: 0,
    });
    prisma.rentalSettlement.aggregate.mockResolvedValue({
      _sum: { remainingFils: null },
      _count: 0,
    });
    prisma.financialTransaction.aggregate.mockResolvedValue({
      _sum: { amountFils: null },
      _count: 0,
    });
    const empty = await repo.financialSummary({});
    expect(empty.revenueFils).toBe(0);
    expect(empty.refundsFils).toBe(0);

    prisma.item.aggregate.mockResolvedValue({
      _sum: { rentalPrice: null, purchasePrice: null, salePrice: null },
      _count: 0,
    });
    await expect(repo.inventoryValue({ deletedAt: null })).resolves.toEqual({
      itemCount: 0,
      rentalPriceSumFils: 0,
      purchasePriceSumFils: 0,
      salePriceSumFils: 0,
    });

    prisma.item.groupBy.mockResolvedValue([
      { categoryId: null, _count: { _all: 1 }, _sum: { rentalPrice: null } },
    ]);
    await expect(repo.inventoryGroupByTaxonomy('categoryId')).resolves.toEqual([
      { id: null, name: null, count: 1, rentalPriceSumFils: 0 },
    ]);

    prisma.rentalSettlement.aggregate.mockResolvedValue({
      _sum: { remainingFils: null, totalFils: null, paidFils: null },
      _count: 0,
    });
    await expect(repo.customerOutstanding('c1')).resolves.toMatchObject({
      outstandingFils: 0,
      totalFils: 0,
      paidFils: 0,
    });
  });
});
