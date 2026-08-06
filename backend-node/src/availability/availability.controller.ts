import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AVAILABILITY_PERMISSION } from './availability.constants';
import { AvailabilityService } from './availability.service';
import { QueryAvailabilityDto, QueryCalendarDto } from './dto/availability.dto';
import { PrismaService } from '../database/prisma.service';

@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions(AVAILABILITY_PERMISSION.VIEW)
  async getAvailability(@Query() q: QueryAvailabilityDto) {
    const start = new Date(q.startDate);
    const end = new Date(q.endDate);
    
    const conflicts = await this.availability.findConflicts({
      itemId: q.itemId,
      start,
      end,
    });

    if (conflicts.length === 0) {
      return {
        available: true,
        reason: null,
        conflicts: [],
      };
    }

    const first = conflicts[0];
    return {
      available: false,
      reason: first.kind === 'reservation' ? 'reservation_overlap' : 'rental_overlap',
      conflicts: conflicts.map((c) => ({
        type: c.kind,
        id: c.id,
        startDate: c.start.toISOString(),
        endDate: c.end.toISOString(),
        status: c.status,
      })),
    };
  }

  @Get('calendar')
  @RequirePermissions(AVAILABILITY_PERMISSION.VIEW)
  async getCalendar(@Query() q: QueryCalendarDto) {
    const start = new Date(q.start);
    const end = new Date(q.end);

    const [resItems, rentalItems] = await Promise.all([
      this.prisma.reservationItem.findMany({
        where: {
          ...(q.itemId ? { itemId: q.itemId } : {}),
          reservation: {
            deletedAt: null,
            status: { in: ['draft', 'confirmed'] },
            startDate: { lte: end },
            expectedReturnDate: { gte: start },
          },
        },
        include: {
          reservation: {
            select: {
              startDate: true,
              expectedReturnDate: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.rentalItem.findMany({
        where: {
          ...(q.itemId ? { itemId: q.itemId } : {}),
          rental: {
            deletedAt: null,
            status: { in: ['draft', 'active', 'checked_out', 'return_pending', 'overdue'] },
            rentalDate: { lte: end },
            expectedReturnDate: { gte: start },
          },
        },
        include: {
          rental: {
            select: {
              rentalDate: true,
              expectedReturnDate: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const list: any[] = [];

    for (const row of resItems) {
      list.push({
        itemId: row.itemId,
        type: 'reservation',
        status: row.reservation.status,
        startDate: row.reservation.startDate.toISOString(),
        endDate: row.reservation.expectedReturnDate.toISOString(),
      });
    }

    for (const row of rentalItems) {
      list.push({
        itemId: row.itemId,
        type: 'rental',
        status: row.rental.status,
        startDate: row.rental.rentalDate.toISOString(),
        endDate: row.rental.expectedReturnDate.toISOString(),
      });
    }

    return list;
  }

  @Get('item/:id')
  @RequirePermissions(AVAILABILITY_PERMISSION.VIEW)
  async getItemAvailability(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id, deletedAt: null },
    });

    if (!item) {
      return null;
    }

    const now = new Date();
    // Check conflicts for a small 5 minute window starting right now
    const nextHour = new Date(now.getTime() + 5 * 60_000);
    const conflicts = await this.availability.findConflicts({
      itemId: id,
      start: now,
      end: nextHour,
    });

    const isAvailableNow = conflicts.length === 0;
    const isRentable = isAvailableNow && (item.lifecycleState === 'available' || item.lifecycleState === 'for_sale');

    // Find active current rental or reservation
    const currentRental = conflicts.find((c) => c.kind === 'rental');
    const currentReservation = conflicts.find((c) => c.kind === 'reservation');

    let currentHolder = null;
    if (currentRental) {
      const activeRental = await this.prisma.rental.findUnique({
        where: { id: currentRental.id },
        include: { customer: { select: { id: true, fullName: true, phone: true } } },
      });
      if (activeRental?.customer) {
        currentHolder = activeRental.customer;
      }
    }

    // Determine next available date
    let nextAvailableDate = now.toISOString();
    let reason = null;

    if (conflicts.length > 0) {
      // Find the furthest expectedReturnDate among the active conflicts
      const furthestDate = new Date(Math.max(...conflicts.map((c) => c.end.getTime())));
      nextAvailableDate = furthestDate.toISOString();
      reason = conflicts[0].kind === 'reservation' ? 'reserved' : 'rented';
    } else if (item.lifecycleState !== 'available' && item.lifecycleState !== 'for_sale') {
      reason = item.lifecycleState;
    }

    return {
      itemId: item.id,
      lifecycleState: item.lifecycleState,
      isAvailable: isAvailableNow && (item.lifecycleState === 'available' || item.lifecycleState === 'for_sale'),
      isRentable,
      currentHolder,
      currentReservation: currentReservation ? {
        id: currentReservation.id,
        number: currentReservation.number,
        startDate: currentReservation.start.toISOString(),
        endDate: currentReservation.end.toISOString(),
        status: currentReservation.status,
      } : null,
      currentRental: currentRental ? {
        id: currentRental.id,
        number: currentRental.number,
        startDate: currentRental.start.toISOString(),
        endDate: currentRental.end.toISOString(),
        status: currentRental.status,
      } : null,
      nextAvailableDate,
      reason,
    };
  }
}
