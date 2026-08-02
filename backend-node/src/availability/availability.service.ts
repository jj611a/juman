import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RENTAL_STATUS } from '../rentals/rentals.constants';
import { RESERVATION_STATUS } from '../reservations/reservations.constants';
import { BusinessException } from '../shared/errors/business.exception';
import {
  rangesOverlap,
  type AvailabilityConflict,
  type AvailabilityTxOptions,
  type AvailabilityWindow,
} from './availability.types';

/** Reservation statuses that still hold a calendar window. */
const BLOCKING_RESERVATION_STATUSES: readonly string[] = [
  RESERVATION_STATUS.DRAFT,
  RESERVATION_STATUS.CONFIRMED,
];

/** Rental statuses that still occupy an item window. */
const BLOCKING_RENTAL_STATUSES: readonly string[] = [
  RENTAL_STATUS.DRAFT,
  RENTAL_STATUS.CHECKED_OUT,
  RENTAL_STATUS.ACTIVE,
  RENTAL_STATUS.RETURN_PENDING,
  RENTAL_STATUS.OVERDUE,
];

/**
 * Sole allocator / conflict detector for item calendar windows.
 * Walk-in rentals, reservation create/checkout, and future transfers must use this service.
 * Cancelled / expired / completed reservations and cancelled / completed rentals are ignored.
 */
@Injectable()
export class AvailabilityService {
  /** Serializes all allocation mutations on SQLite (write-lock via SequenceCounter). */
  static readonly ALLOCATION_LOCK_PREFIX = '__allocation_lock__';

  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  /**
   * Run allocation work under an exclusive write lock.
   * Availability check + persistence must happen inside this callback (no TOCTOU).
   */
  async runExclusive<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await this.acquireAllocationLock(tx);
        return fn(tx);
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
  }

  async acquireAllocationLock(tx: Prisma.TransactionClient): Promise<void> {
    const prefix = AvailabilityService.ALLOCATION_LOCK_PREFIX;
    const existing = await tx.sequenceCounter.findUnique({ where: { prefix } });
    if (!existing) {
      try {
        await tx.sequenceCounter.create({ data: { prefix, lastValue: 0 } });
      } catch {
        // Concurrent first-time create — proceed to update.
      }
    }
    await tx.sequenceCounter.update({
      where: { prefix },
      data: { lastValue: { increment: 1 } },
    });
  }

  async findConflicts(
    window: AvailabilityWindow,
    opts?: AvailabilityTxOptions,
  ): Promise<AvailabilityConflict[]> {
    if (window.end.getTime() <= window.start.getTime()) {
      return [];
    }

    const client = this.db(opts?.tx);
    const [reservationRows, rentalRows] = await Promise.all([
      client.reservationItem.findMany({
        where: {
          itemId: window.itemId,
          reservation: {
            deletedAt: null,
            status: { in: [...BLOCKING_RESERVATION_STATUSES] },
            ...(window.excludeReservationId
              ? { id: { not: window.excludeReservationId } }
              : {}),
          },
        },
        include: {
          reservation: {
            select: {
              id: true,
              reservationNumber: true,
              startDate: true,
              expectedReturnDate: true,
              status: true,
            },
          },
        },
      }),
      client.rentalItem.findMany({
        where: {
          itemId: window.itemId,
          rental: {
            deletedAt: null,
            status: { in: [...BLOCKING_RENTAL_STATUSES] },
            ...(window.excludeRentalId
              ? { id: { not: window.excludeRentalId } }
              : {}),
          },
        },
        include: {
          rental: {
            select: {
              id: true,
              rentalNumber: true,
              rentalDate: true,
              expectedReturnDate: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const conflicts: AvailabilityConflict[] = [];

    for (const row of reservationRows) {
      const r = row.reservation;
      if (
        rangesOverlap(
          window.start,
          window.end,
          r.startDate,
          r.expectedReturnDate,
        )
      ) {
        conflicts.push({
          kind: 'reservation',
          id: r.id,
          number: r.reservationNumber,
          itemId: window.itemId,
          start: r.startDate,
          end: r.expectedReturnDate,
          status: r.status,
        });
      }
    }

    for (const row of rentalRows) {
      const r = row.rental;
      if (
        rangesOverlap(
          window.start,
          window.end,
          r.rentalDate,
          r.expectedReturnDate,
        )
      ) {
        conflicts.push({
          kind: 'rental',
          id: r.id,
          number: r.rentalNumber,
          itemId: window.itemId,
          start: r.rentalDate,
          end: r.expectedReturnDate,
          status: r.status,
        });
      }
    }

    return conflicts;
  }

  async assertAvailable(
    window: AvailabilityWindow,
    opts?: AvailabilityTxOptions,
  ): Promise<void> {
    const conflicts = await this.findConflicts(window, opts);
    if (conflicts.length === 0) return;
    const first = conflicts[0];
    throw BusinessException.conflict(
      `Item has conflicting ${first.kind} ${first.number} (${first.status})`,
      conflicts.map(
        (c) => `${c.kind}:${c.number}:${c.status}:${c.start.toISOString()}`,
      ),
    );
  }

  async assertItemsAvailable(
    itemIds: string[],
    start: Date,
    end: Date,
    opts?: {
      excludeReservationId?: string | null;
      excludeRentalId?: string | null;
      tx?: Prisma.TransactionClient;
    },
  ): Promise<void> {
    for (const itemId of itemIds) {
      await this.assertAvailable(
        {
          itemId,
          start,
          end,
          excludeReservationId: opts?.excludeReservationId,
          excludeRentalId: opts?.excludeRentalId,
        },
        { tx: opts?.tx },
      );
    }
  }
}
