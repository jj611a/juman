import { Injectable } from '@nestjs/common';
import type { Prisma, Reservation } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  restoreSoftDeleteData,
  softDeleteData,
} from '../shared/soft-delete/soft-delete';
import { RESERVATION_STATUS } from './reservations.constants';

export const reservationInclude = {
  customer: true,
  items: {
    include: {
      item: {
        select: {
          id: true,
          internalCode: true,
          displayName: true,
          status: true,
          lifecycleState: true,
          rentalPrice: true,
        },
      },
    },
  },
  statusHistory: { orderBy: { createdAt: 'desc' as const }, take: 50 },
  rental: { select: { id: true, rentalNumber: true, status: true } },
} satisfies Prisma.ReservationInclude;

export type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

@Injectable()
export class ReservationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
  }

  async createConfirmed(input: {
    data: Prisma.ReservationUncheckedCreateInput;
    items: Array<{
      itemId: string;
      barcodeValue?: string | null;
      agreedRentalPrice: number;
      notes?: string | null;
      createdBy?: string | null;
    }>;
    actor?: { userId?: string | null; username?: string | null };
    tx?: Prisma.TransactionClient;
  }): Promise<ReservationWithRelations> {
    if (input.tx) {
      return this.createConfirmedInTx(input.tx, input);
    }
    return this.prisma.$transaction((tx) => this.createConfirmedInTx(tx, input));
  }

  async createConfirmedInTx(
    tx: Prisma.TransactionClient,
    input: {
      data: Prisma.ReservationUncheckedCreateInput;
      items: Array<{
        itemId: string;
        barcodeValue?: string | null;
        agreedRentalPrice: number;
        notes?: string | null;
        createdBy?: string | null;
      }>;
      actor?: { userId?: string | null; username?: string | null };
    },
  ): Promise<ReservationWithRelations> {
    const created = await tx.reservation.create({
      data: {
        ...input.data,
        status: RESERVATION_STATUS.DRAFT,
        items: {
          create: input.items.map((i) => ({
            itemId: i.itemId,
            barcodeValue: i.barcodeValue ?? null,
            agreedRentalPrice: i.agreedRentalPrice,
            notes: i.notes ?? null,
            createdBy: i.createdBy ?? null,
          })),
        },
        statusHistory: {
          create: {
            oldStatus: RESERVATION_STATUS.DRAFT,
            newStatus: RESERVATION_STATUS.DRAFT,
            reason: 'created',
            userId: input.actor?.userId ?? null,
            username: input.actor?.username ?? null,
          },
        },
      },
    });

    await tx.reservation.update({
      where: { id: created.id },
      data: {
        status: RESERVATION_STATUS.CONFIRMED,
        updatedBy: input.actor?.userId ?? null,
      },
    });
    await tx.reservationStatusHistory.create({
      data: {
        reservationId: created.id,
        oldStatus: RESERVATION_STATUS.DRAFT,
        newStatus: RESERVATION_STATUS.CONFIRMED,
        reason: 'confirmed',
        userId: input.actor?.userId ?? null,
        username: input.actor?.username ?? null,
      },
    });

    return tx.reservation.findUniqueOrThrow({
      where: { id: created.id },
      include: reservationInclude,
    });
  }

  findById(
    id: string,
    deleted = false,
  ): Promise<ReservationWithRelations | null> {
    return this.prisma.reservation.findFirst({
      where: { id, deletedAt: deleted ? { not: null } : null },
      include: reservationInclude,
    });
  }

  findAnyNumber(reservationNumber: string): Promise<Reservation | null> {
    return this.prisma.reservation.findUnique({ where: { reservationNumber } });
  }

  async list(input: {
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
        include: reservationInclude,
      }),
      this.prisma.reservation.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  async nextSequence(prefix: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const e = await tx.sequenceCounter.findUnique({ where: { prefix } });
      if (!e) {
        await tx.sequenceCounter.create({ data: { prefix, lastValue: 1 } });
        return 1;
      }
      return (
        await tx.sequenceCounter.update({
          where: { prefix },
          data: { lastValue: e.lastValue + 1 },
        })
      ).lastValue;
    });
  }

  async transitionStatus(input: {
    reservationId: string;
    from: string;
    to: string;
    reason?: string | null;
    userId?: string | null;
    username?: string | null;
    tx?: Prisma.TransactionClient;
  }): Promise<ReservationWithRelations | null> {
    const run = async (client: Prisma.TransactionClient) => {
      const result = await client.reservation.updateMany({
        where: {
          id: input.reservationId,
          deletedAt: null,
          status: input.from,
        },
        data: {
          status: input.to,
          updatedBy: input.userId ?? null,
        },
      });
      if (result.count !== 1) return null;
      await client.reservationStatusHistory.create({
        data: {
          reservationId: input.reservationId,
          oldStatus: input.from,
          newStatus: input.to,
          reason: input.reason ?? null,
          userId: input.userId ?? null,
          username: input.username ?? null,
        },
      });
      return client.reservation.findUniqueOrThrow({
        where: { id: input.reservationId },
        include: reservationInclude,
      });
    };
    if (input.tx) return run(input.tx);
    return this.prisma.$transaction(run);
  }

  softDelete(id: string, userId?: string) {
    return this.prisma.reservation.update({
      where: { id },
      data: {
        ...softDeleteData(),
        deletedBy: userId ?? null,
      },
      include: reservationInclude,
    });
  }

  restore(id: string, userId?: string) {
    return this.prisma.reservation.update({
      where: { id },
      data: {
        ...restoreSoftDeleteData(),
        deletedBy: null,
        updatedBy: userId ?? null,
      },
      include: reservationInclude,
    });
  }
}
