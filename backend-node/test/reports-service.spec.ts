import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessException } from '../src/shared/errors/business.exception';
import { REPORT_KIND } from '../src/reports/reports.constants';
import { ReportsService } from '../src/reports/reports.service';
import type { AuthPrincipal } from '../src/shared/types';

describe('ReportsService', () => {
  const repo = {
    dashboardSummary: vi.fn(),
    financialSummary: vi.fn(),
    listRentals: vi.fn(),
    listReservations: vi.fn(),
    inventoryValue: vi.fn(),
    inventoryAvailability: vi.fn(),
    inventoryGroupByTaxonomy: vi.fn(),
    listItems: vi.fn(),
    customerOutstanding: vi.fn(),
    listPayments: vi.fn(),
    findCustomer: vi.fn(),
  };
  const exporters = {
    export: vi.fn(),
    implementedFormats: vi.fn(() => ['csv', 'json'] as const),
  };
  let service: ReportsService;

  const principal = (perms: string[]): AuthPrincipal =>
    ({
      userId: 'u1',
      username: 'admin',
      roleId: 'r1',
      roleName: 'Admin',
      permissions: perms,
      sessionId: 's1',
      mustChangePassword: false,
    }) as AuthPrincipal;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReportsService(repo as never, exporters as never);
    repo.listRentals.mockResolvedValue({ rows: [{ id: 'r1' }], total: 1 });
    repo.listReservations.mockResolvedValue({
      rows: [{ id: 'res1' }],
      total: 1,
    });
    repo.listItems.mockResolvedValue({ rows: [{ id: 'i1' }], total: 1 });
    repo.listPayments.mockResolvedValue({
      rows: [{ id: 'p1', amountFils: 100 }],
      total: 1,
    });
    repo.findCustomer.mockResolvedValue({
      id: 'c1',
      customerNumber: 'CUS-1',
      fullName: 'Ali',
      status: 'active',
      phone: '07',
    });
  });

  it('returns dashboard and financial summaries', async () => {
    repo.dashboardSummary.mockResolvedValue({ activeRentals: 2 });
    repo.financialSummary.mockResolvedValue({ revenueFils: 500 });
    await expect(service.dashboard()).resolves.toEqual({ activeRentals: 2 });
    await expect(
      service.financial({ from: '2026-08-01T00:00:00.000Z' }),
    ).resolves.toEqual({ revenueFils: 500 });
    expect(repo.financialSummary).toHaveBeenCalledWith({
      from: new Date('2026-08-01T00:00:00.000Z'),
      to: undefined,
    });
  });

  it('lists rental report variants with filters', async () => {
    await service.rentalsCurrent({ customerId: 'c1', limit: 10 });
    await service.rentalsOverdue({ status: 'overdue' });
    await service.rentalsReturns({
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T23:59:59.999Z',
    });
    await service.rentalsHistory({ status: 'completed' });
    expect(repo.listRentals).toHaveBeenCalledTimes(4);
    const currentWhere = repo.listRentals.mock.calls[0]![0].where;
    expect(currentWhere.customerId).toBe('c1');
    expect(currentWhere.status).toEqual({
      in: ['checked_out', 'active', 'return_pending', 'overdue'],
    });
  });

  it('lists reservation activity', async () => {
    const page = await service.rentalsReservations({
      employeeId: 'e1',
      itemId: 'i1',
      from: '2026-08-01T00:00:00.000Z',
    });
    expect(page.meta.total).toBe(1);
    expect(repo.listReservations.mock.calls[0]![0].where.createdBy).toBe('e1');
  });

  it('covers inventory report variants', async () => {
    repo.inventoryValue.mockResolvedValue({ itemCount: 3 });
    repo.inventoryAvailability.mockResolvedValue([
      { lifecycleState: 'available', count: 2 },
    ]);
    repo.inventoryGroupByTaxonomy.mockResolvedValue([
      { id: 'x', name: 'N', count: 1, rentalPriceSumFils: 10 },
    ]);
    await expect(service.inventoryValue({ categoryId: 'cat' })).resolves.toEqual(
      { itemCount: 3 },
    );
    await expect(service.inventoryAvailability()).resolves.toHaveLength(1);
    await expect(service.inventoryLifecycle()).resolves.toHaveLength(1);
    await expect(service.inventoryCategory()).resolves.toHaveLength(1);
    await expect(service.inventoryBrand()).resolves.toHaveLength(1);
    await expect(service.inventoryColor()).resolves.toHaveLength(1);
    await expect(service.inventorySize()).resolves.toHaveLength(1);
    expect(repo.inventoryGroupByTaxonomy).toHaveBeenCalledWith('categoryId');
    expect(repo.inventoryGroupByTaxonomy).toHaveBeenCalledWith('brandId');
    expect(repo.inventoryGroupByTaxonomy).toHaveBeenCalledWith('colorId');
    expect(repo.inventoryGroupByTaxonomy).toHaveBeenCalledWith('sizeId');
    await service.inventoryRetired({});
    await service.inventoryMaintenance({});
    expect(repo.listItems).toHaveBeenCalledTimes(2);
  });

  it('covers customer reports and missing customer', async () => {
    repo.customerOutstanding.mockResolvedValue({
      customerId: 'c1',
      outstandingFils: 0,
    });
    await expect(service.customerOutstanding('c1')).resolves.toMatchObject({
      outstandingFils: 0,
    });
    await service.customerRentals('c1', {});
    await service.customerPayments('c1', {
      settlementId: 's1',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-02T00:00:00.000Z',
    });
    await service.customerReservations('c1', {});
    repo.findCustomer.mockResolvedValueOnce(null);
    await expect(service.customerOutstanding('missing')).rejects.toThrow(
      BusinessException,
    );
  });

  it('exports reports and enforces financial permission', async () => {
    repo.dashboardSummary.mockResolvedValue({
      activeRentals: 1,
      asOf: 'now',
    });
    exporters.export.mockReturnValue({
      format: 'csv',
      contentType: 'text/csv',
      filename: 'x.csv',
      body: 'a,b',
    });
    const result = await service.export(
      { report: REPORT_KIND.DASHBOARD, format: 'csv' },
      principal(['reports.export']),
    );
    expect(result.filename).toBe('x.csv');
    expect(exporters.export).toHaveBeenCalled();

    await expect(
      service.export(
        { report: REPORT_KIND.FINANCIAL, format: 'json' },
        principal(['reports.export']),
      ),
    ).rejects.toThrow(ForbiddenException);

    repo.financialSummary.mockResolvedValue({ revenueFils: 1 });
    exporters.export.mockReturnValue({
      format: 'json',
      contentType: 'application/json',
      filename: 'f.json',
      body: '{}',
    });
    await service.export(
      { report: REPORT_KIND.FINANCIAL, format: 'json' },
      principal(['reports.export', 'reports.financial.view']),
    );
  });

  it('resolves export kinds including customer and inventory lists', async () => {
    exporters.export.mockReturnValue({
      format: 'json',
      contentType: 'application/json',
      filename: 'r.json',
      body: '[]',
    });
    repo.listRentals.mockResolvedValue({
      rows: [
        {
          id: 'r1',
          rentalDate: new Date('2026-08-01'),
          customer: { id: 'c1', fullName: 'Ali' },
        },
      ],
      total: 1,
    });
    repo.inventoryAvailability.mockResolvedValue([
      { lifecycleState: 'available', count: 1 },
    ]);
    repo.customerOutstanding.mockResolvedValue({ outstandingFils: 9 });

    const kinds = [
      REPORT_KIND.RENTALS_CURRENT,
      REPORT_KIND.RENTALS_OVERDUE,
      REPORT_KIND.RENTALS_RETURNS,
      REPORT_KIND.RENTALS_RESERVATIONS,
      REPORT_KIND.RENTALS_HISTORY,
      REPORT_KIND.INVENTORY_VALUE,
      REPORT_KIND.INVENTORY_AVAILABILITY,
      REPORT_KIND.INVENTORY_LIFECYCLE,
      REPORT_KIND.INVENTORY_CATEGORY,
      REPORT_KIND.INVENTORY_BRAND,
      REPORT_KIND.INVENTORY_COLOR,
      REPORT_KIND.INVENTORY_SIZE,
      REPORT_KIND.INVENTORY_RETIRED,
      REPORT_KIND.INVENTORY_MAINTENANCE,
      REPORT_KIND.CUSTOMER_OUTSTANDING,
      REPORT_KIND.CUSTOMER_RENTALS,
      REPORT_KIND.CUSTOMER_PAYMENTS,
      REPORT_KIND.CUSTOMER_RESERVATIONS,
    ] as const;

    repo.inventoryValue.mockResolvedValue({ itemCount: 1 });
    repo.inventoryGroupByTaxonomy.mockResolvedValue([]);

    for (const kind of kinds) {
      const q: Record<string, string> = { report: kind, format: 'json' };
      if (kind.startsWith('customer.')) q.customerId = 'c1';
      await service.export(q as never, principal(['reports.export']));
    }

    await expect(
      service.export(
        { report: REPORT_KIND.CUSTOMER_RENTALS, format: 'json' } as never,
        principal(['reports.export']),
      ),
    ).rejects.toThrow(BusinessException);

    expect(service.implementedExportFormats()).toEqual(['csv', 'json']);
  });

  it('rejects invalid sort fields', async () => {
    await expect(
      service.rentalsCurrent({ sortBy: 'hacker' }),
    ).rejects.toThrow(BusinessException);
  });

  it('covers remaining filter and export edge branches', async () => {
    await service.rentalsCurrent({
      status: 'active',
      employeeId: 'e1',
      itemId: 'i9',
      settlementId: 's9',
    });
    const where = repo.listRentals.mock.calls.at(-1)![0].where;
    expect(where.status).toBe('active');
    expect(where.createdBy).toBe('e1');
    expect(where.settlement).toEqual({ id: 's9' });

    await service.rentalsReturns({ status: 'completed' });
    await service.inventoryValue({
      brandId: 'b1',
      colorId: 'c1',
      sizeId: 's1',
      itemId: 'i1',
      status: 'active',
    });

    exporters.export.mockReturnValue({
      format: 'json',
      contentType: 'application/json',
      filename: 'x.json',
      body: '{}',
    });
    for (const kind of [
      REPORT_KIND.CUSTOMER_OUTSTANDING,
      REPORT_KIND.CUSTOMER_PAYMENTS,
      REPORT_KIND.CUSTOMER_RESERVATIONS,
    ]) {
      await expect(
        service.export(
          { report: kind, format: 'json' } as never,
          principal(['reports.export']),
        ),
      ).rejects.toThrow(BusinessException);
    }

    await expect(
      service.export(
        { report: 'not.a.report' as never, format: 'json' },
        principal(['reports.export']),
      ),
    ).rejects.toThrow(BusinessException);

    repo.listReservations.mockResolvedValue({
      rows: [
        {
          id: 'res1',
          startDate: new Date('2026-08-01'),
          customer: { id: 'c1', fullName: 'Ali' },
        },
      ],
      total: 1,
    });
    await service.export(
      {
        report: REPORT_KIND.RENTALS_RESERVATIONS,
        format: 'json',
        status: 'confirmed',
        customerId: 'c1',
        to: '2026-08-31T00:00:00.000Z',
      } as never,
      principal(['reports.export']),
    );

    await service.customerPayments('c1', { status: 'pending' });
  });
});
