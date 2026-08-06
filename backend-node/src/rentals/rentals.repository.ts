import { Injectable } from '@nestjs/common';
import type { Prisma, Rental } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  restoreSoftDeleteData,
  softDeleteData,
} from '../shared/soft-delete/soft-delete';
import { RENTAL_STATUS } from './rentals.constants';

export const rentalInclude = {
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
} satisfies Prisma.RentalInclude;

export type RentalWithRelations = Prisma.RentalGetPayload<{
  include: typeof rentalInclude;
}>;

type RentalLineInput = {
  itemId: string;
  barcodeValue?: string | null;
  agreedRentalPrice: number;
  notes?: string | null;
  createdBy?: string | null;
};

@Injectable()
export class RentalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
  }

  create(
    data: Prisma.RentalUncheckedCreateInput,
    items: RentalLineInput[],
    actor?: { userId?: string | null; username?: string | null },
  ): Promise<RentalWithRelations> {
    return this.prisma.$transaction(async (tx) =>
      this.createInTx(tx, data, items, actor),
    );
  }

  async createInTx(
    tx: Prisma.TransactionClient,
    data: Prisma.RentalUncheckedCreateInput,
    items: RentalLineInput[],
    actor?: { userId?: string | null; username?: string | null },
  ): Promise<RentalWithRelations> {
    const rental = await tx.rental.create({
      data: {
        ...data,
        items: {
          create: items.map((i) => ({
            itemId: i.itemId,
            barcodeValue: i.barcodeValue ?? null,
            agreedRentalPrice: i.agreedRentalPrice,
            notes: i.notes ?? null,
            createdBy: i.createdBy ?? null,
          })),
        },
        statusHistory: {
          create: {
            oldStatus: RENTAL_STATUS.DRAFT,
            newStatus: data.status ?? RENTAL_STATUS.DRAFT,
            reason: 'created',
            userId: actor?.userId ?? null,
            username: actor?.username ?? null,
          },
        },
      },
    });
    return tx.rental.findUniqueOrThrow({
      where: { id: rental.id },
      include: rentalInclude,
    });
  }

  findById(id: string, deleted = false): Promise<RentalWithRelations | null> {
    return this.prisma.rental.findFirst({
      where: { id, deletedAt: deleted ? { not: null } : null },
      include: rentalInclude,
    });
  }

  findByNumber(rentalNumber: string): Promise<RentalWithRelations | null> {
    return this.prisma.rental.findFirst({
      where: { rentalNumber, deletedAt: null },
      include: rentalInclude,
    });
  }

  findAnyNumber(rentalNumber: string): Promise<Rental | null> {
    return this.prisma.rental.findUnique({ where: { rentalNumber } });
  }

  async list(input: {
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
        include: rentalInclude,
      }),
      this.prisma.rental.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  async nextSequence(
    prefix: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const run = async (client: Prisma.TransactionClient) => {
      const e = await client.sequenceCounter.findUnique({ where: { prefix } });
      if (!e) {
        await client.sequenceCounter.create({ data: { prefix, lastValue: 1 } });
        return 1;
      }
      return (
        await client.sequenceCounter.update({
          where: { prefix },
          data: { lastValue: e.lastValue + 1 },
        })
      ).lastValue;
    };
    if (tx) return run(tx);
    return this.prisma.$transaction(run);
  }

  async transitionStatus(input: {
    rentalId: string;
    from: string;
    to: string;
    reason?: string | null;
    userId?: string | null;
    username?: string | null;
    extra?: Prisma.RentalUncheckedUpdateInput;
    tx?: Prisma.TransactionClient;
  }): Promise<RentalWithRelations | null> {
    const run = async (client: Prisma.TransactionClient) => {
      const result = await client.rental.updateMany({
        where: {
          id: input.rentalId,
          deletedAt: null,
          status: input.from,
        },
        data: {
          status: input.to,
          updatedBy: input.userId ?? null,
          ...(input.extra ?? {}),
        },
      });
      if (result.count !== 1) return null;
      await client.rentalStatusHistory.create({
        data: {
          rentalId: input.rentalId,
          oldStatus: input.from,
          newStatus: input.to,
          reason: input.reason ?? null,
          userId: input.userId ?? null,
          username: input.username ?? null,
        },
      });
      return client.rental.findUniqueOrThrow({
        where: { id: input.rentalId },
        include: rentalInclude,
      });
    };
    if (input.tx) return run(input.tx);
    return this.prisma.$transaction(run);
  }

  softDelete(id: string, userId?: string) {
    return this.prisma.rental.update({
      where: { id },
      data: {
        ...softDeleteData(),
        deletedBy: userId ?? null,
        status: RENTAL_STATUS.CANCELLED,
      },
      include: rentalInclude,
    });
  }

  updateNotes(id: string, notes: string | null, userId?: string | null) {
    return this.prisma.rental.update({
      where: { id },
      data: {
        notes,
        updatedBy: userId ?? null,
      },
      include: rentalInclude,
    });
  }

  restore(id: string, userId?: string) {
    return this.prisma.rental.update({
      where: { id },
      data: {
        ...restoreSoftDeleteData(),
        deletedBy: null,
        updatedBy: userId ?? null,
      },
      include: rentalInclude,
    });
  }
}
