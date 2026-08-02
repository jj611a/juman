import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { BusinessException } from '../../shared/errors/business.exception';

export const settlementInclude = {
  history: { orderBy: { createdAt: 'desc' as const }, take: 50 },
  rental: {
    select: {
      id: true,
      rentalNumber: true,
      status: true,
      customerId: true,
    },
  },
  account: {
    select: {
      id: true,
      accountNumber: true,
      customerId: true,
      status: true,
    },
  },
} satisfies Prisma.RentalSettlementInclude;

export type SettlementWithRelations = Prisma.RentalSettlementGetPayload<{
  include: typeof settlementInclude;
}>;

@Injectable()
export class SettlementRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
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

  findById(
    id: string,
    deleted = false,
  ): Promise<SettlementWithRelations | null> {
    return this.prisma.rentalSettlement.findFirst({
      where: { id, deletedAt: deleted ? { not: null } : null },
      include: settlementInclude,
    });
  }

  findByRentalId(rentalId: string): Promise<SettlementWithRelations | null> {
    return this.prisma.rentalSettlement.findFirst({
      where: { rentalId, deletedAt: null },
      include: settlementInclude,
    });
  }

  findAnyNumber(settlementNumber: string) {
    return this.prisma.rentalSettlement.findUnique({
      where: { settlementNumber },
    });
  }

  async list(input: {
    where: Prisma.RentalSettlementWhereInput;
    orderBy: Prisma.RentalSettlementOrderByWithRelationInput;
    offset: number;
    limit: number;
  }) {
    const [rows, total] = await Promise.all([
      this.prisma.rentalSettlement.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
        include: settlementInclude,
      }),
      this.prisma.rentalSettlement.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  create(
    tx: Prisma.TransactionClient,
    data: Prisma.RentalSettlementUncheckedCreateInput,
    history: {
      oldStatus: string;
      newStatus: string;
      action: string;
      reason?: string | null;
      userId?: string | null;
      username?: string | null;
    },
  ): Promise<SettlementWithRelations> {
    return tx.rentalSettlement.create({
      data: {
        ...data,
        history: {
          create: {
            oldStatus: history.oldStatus,
            newStatus: history.newStatus,
            action: history.action,
            reason: history.reason ?? null,
            userId: history.userId ?? null,
            username: history.username ?? null,
          },
        },
      },
      include: settlementInclude,
    });
  }

  /**
   * CAS apply payment against expected remaining — concurrent-safe on SQLite.
   */
  async applyPaymentCas(
    tx: Prisma.TransactionClient,
    input: {
      settlementId: string;
      expectedRemaining: number;
      fromStatus: string;
      amountFils: number;
      newPaid: number;
      newRemaining: number;
      newStatus: string;
      paymentId: string;
      userId?: string | null;
      username?: string | null;
    },
  ): Promise<SettlementWithRelations | null> {
    const result = await tx.rentalSettlement.updateMany({
      where: {
        id: input.settlementId,
        deletedAt: null,
        remainingFils: input.expectedRemaining,
        status: input.fromStatus,
      },
      data: {
        paidFils: input.newPaid,
        remainingFils: input.newRemaining,
        status: input.newStatus,
        updatedBy: input.userId ?? null,
      },
    });
    if (result.count !== 1) return null;

    await tx.settlementHistory.create({
      data: {
        settlementId: input.settlementId,
        oldStatus: input.fromStatus,
        newStatus: input.newStatus,
        action: 'payment_applied',
        amountFils: input.amountFils,
        paymentId: input.paymentId,
        userId: input.userId ?? null,
        username: input.username ?? null,
      },
    });

    return tx.rentalSettlement.findUniqueOrThrow({
      where: { id: input.settlementId },
      include: settlementInclude,
    });
  }

  async transitionStatus(
    tx: Prisma.TransactionClient,
    input: {
      settlementId: string;
      from: string;
      to: string;
      action: string;
      reason?: string | null;
      userId?: string | null;
      username?: string | null;
      extra?: Prisma.RentalSettlementUncheckedUpdateInput;
    },
  ): Promise<SettlementWithRelations | null> {
    const result = await tx.rentalSettlement.updateMany({
      where: {
        id: input.settlementId,
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
    await tx.settlementHistory.create({
      data: {
        settlementId: input.settlementId,
        oldStatus: input.from,
        newStatus: input.to,
        action: input.action,
        reason: input.reason ?? null,
        userId: input.userId ?? null,
        username: input.username ?? null,
      },
    });
    return tx.rentalSettlement.findUniqueOrThrow({
      where: { id: input.settlementId },
      include: settlementInclude,
    });
  }

  async lockSettlement(
    tx: Prisma.TransactionClient,
    settlementId: string,
  ): Promise<void> {
    const result = await tx.rentalSettlement.updateMany({
      where: { id: settlementId, deletedAt: null },
      data: { updatedAt: new Date() },
    });
    if (result.count !== 1) {
      throw BusinessException.conflict('Settlement lock failed');
    }
  }
}
