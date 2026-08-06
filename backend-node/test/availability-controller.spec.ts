import { describe, expect, it, vi } from 'vitest';
import { AvailabilityController } from '../src/availability/availability.controller';

describe('AvailabilityController', () => {
  it('delegates availability query correctly', async () => {
    const mockAvailabilityService = {
      findConflicts: vi.fn().mockResolvedValue([]),
    };
    const mockPrismaService = {
      reservationItem: { findMany: vi.fn().mockResolvedValue([]) },
      rentalItem: { findMany: vi.fn().mockResolvedValue([]) },
      item: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'item-1',
          displayName: 'Bride Dress',
          internalCode: 'DR-0001',
          lifecycleState: 'available',
        }),
      },
      rental: { findUnique: vi.fn().mockResolvedValue(null) },
    };

    const controller = new AvailabilityController(
      mockAvailabilityService as any,
      mockPrismaService as any,
    );

    const res = await controller.getAvailability({
      itemId: 'item-1',
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-05T00:00:00.000Z',
    });

    expect(res.available).toBe(true);
    expect(mockAvailabilityService.findConflicts).toHaveBeenCalled();

    const cal = await controller.getCalendar({
      start: '2026-08-01T00:00:00.000Z',
      end: '2026-08-05T00:00:00.000Z',
    });
    expect(Array.isArray(cal)).toBe(true);

    const itemStatus = await controller.getItemAvailability('item-1');
    expect(itemStatus?.itemId).toBe('item-1');
    expect(itemStatus?.isAvailable).toBe(true);
  });
});
