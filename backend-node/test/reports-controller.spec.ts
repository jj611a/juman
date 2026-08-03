import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { StreamableFile } from '@nestjs/common';
import { ReportsController } from '../src/reports/reports.controller';
import type { AuthPrincipal } from '../src/shared/types';

describe('ReportsController', () => {
  const reports = {
    dashboard: vi.fn(async () => ({ activeRentals: 1 })),
    financial: vi.fn(async () => ({ revenueFils: 1 })),
    rentalsCurrent: vi.fn(async () => ({ items: [], meta: {} })),
    rentalsOverdue: vi.fn(async () => ({ items: [], meta: {} })),
    rentalsReturns: vi.fn(async () => ({ items: [], meta: {} })),
    rentalsReservations: vi.fn(async () => ({ items: [], meta: {} })),
    rentalsHistory: vi.fn(async () => ({ items: [], meta: {} })),
    inventoryValue: vi.fn(async () => ({ itemCount: 0 })),
    inventoryAvailability: vi.fn(async () => []),
    inventoryCategory: vi.fn(async () => []),
    inventoryBrand: vi.fn(async () => []),
    inventoryColor: vi.fn(async () => []),
    inventorySize: vi.fn(async () => []),
    inventoryLifecycle: vi.fn(async () => []),
    inventoryRetired: vi.fn(async () => ({ items: [], meta: {} })),
    inventoryMaintenance: vi.fn(async () => ({ items: [], meta: {} })),
    customerRentals: vi.fn(async () => ({ items: [], meta: {} })),
    customerOutstanding: vi.fn(async () => ({ outstandingFils: 0 })),
    customerPayments: vi.fn(async () => ({ items: [], meta: {} })),
    customerReservations: vi.fn(async () => ({ items: [], meta: {} })),
    export: vi.fn(),
  };

  const controller = new ReportsController(reports as never);
  const user = {
    permissions: ['reports.export'],
  } as AuthPrincipal;

  it('delegates read endpoints', async () => {
    await expect(controller.dashboard()).resolves.toEqual({ activeRentals: 1 });
    await controller.financial({});
    await controller.rentalsCurrent({});
    await controller.rentalsOverdue({});
    await controller.rentalsReturns({});
    await controller.rentalsReservations({});
    await controller.rentalsHistory({});
    await controller.inventoryValue({});
    await controller.inventoryAvailability();
    await controller.inventoryCategory();
    await controller.inventoryBrand();
    await controller.inventoryColor();
    await controller.inventorySize();
    await controller.inventoryLifecycle();
    await controller.inventoryRetired({});
    await controller.inventoryMaintenance({});
    await controller.customerRentals('c1', {});
    await controller.customerOutstanding('c1');
    await controller.customerPayments('c1', {});
    await controller.customerReservations('c1', {});
  });

  it('exports string and buffer bodies as StreamableFile', async () => {
    reports.export.mockResolvedValueOnce({
      format: 'csv',
      contentType: 'text/csv',
      filename: 'a.csv',
      body: 'a,b',
    });
    const stringFile = await controller.export(
      { report: 'dashboard', format: 'csv' } as never,
      user,
    );
    expect(stringFile).toBeInstanceOf(StreamableFile);

    reports.export.mockResolvedValueOnce({
      format: 'csv',
      contentType: 'text/csv',
      filename: 'b.csv',
      body: Buffer.from('x'),
    });
    const bufFile = await controller.export(
      { report: 'dashboard', format: 'csv' } as never,
      user,
    );
    expect(bufFile).toBeInstanceOf(StreamableFile);
  });
});
