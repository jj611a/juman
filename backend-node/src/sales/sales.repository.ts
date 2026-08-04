import { Injectable } from '@nestjs/common';
import type { Prisma, Sale } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SALE_HISTORY_ACTION, SALE_STATUS } from './sales.constants';

export const saleInclude = {
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
          salePrice: true,
        },
      },
    },
  },
  history: { orderBy: { createdAt: 'desc' as const }, take: 50 },
  settlement: {
    select: {
      id: true,
      settlementNumber: true,
      status: true,
      totalFils: true,
      paidFils: true,
      remainingFils: true,
      customerId: true,
      accountId: true,
    },
  },
} satisfies Prisma.SaleInclude;

export type SaleWithRelations = Prisma.SaleGetPayload<{
  include: typeof saleInclude;
}>;

type SaleLineInput = {
  itemId: string;
  priceFils: number;
  discountFils: number;
  quantity: number;
  totalFils: number;
  barcodeSnapshot?: string | null;
  itemNameSnapshot?: string | null;
  createdBy?: string | null;
};

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
  }

  create(
    data: Prisma.SaleUncheckedCreateInput,
    items: SaleLineInput[],
    actor?: { userId?: string | null; username?: string | null },
  ): Promise<SaleWithRelations> {
    return this.prisma.$transaction(async (tx) =>
      this.createInTx(tx, data, items, actor),
    );
  }

  async createInTx(
    tx: Prisma.TransactionClient,
    data: Prisma.SaleUncheckedCreateInput,
    items: SaleLineInput[],
    actor?: { userId?: string | null; username?: string | null },
  ): Promise<SaleWithRelations> {
    const sale = await tx.sale.create({
      data: {
        ...data,
        items: {
          create: items.map((i) => ({
            itemId: i.itemId,
            priceFils: i.priceFils,
            discountFils: i.discountFils,
            quantity: i.quantity,
            totalFils: i.totalFils,
            barcodeSnapshot: i.barcodeSnapshot ?? null,
            itemNameSnapshot: i.itemNameSnapshot ?? null,
            createdBy: i.createdBy ?? null,
          })),
        },
        history: {
          create: {
            oldStatus: SALE_STATUS.DRAFT,
            newStatus: data.status ?? SALE_STATUS.DRAFT,
            action: SALE_HISTORY_ACTION.CREATED,
            reason: 'created',
            userId: actor?.userId ?? null,
            username: actor?.username ?? null,
          },
        },
      },
    });
    return tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: saleInclude,
    });
  }

  findById(id: string, deleted = false): Promise<SaleWithRelations | null> {
    return this.prisma.sale.findFirst({
      where: { id, deletedAt: deleted ? { not: null } : null },
      include: saleInclude,
    });
  }

  findByIdInTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<SaleWithRelations | null> {
    return tx.sale.findFirst({
      where: { id, deletedAt: null },
      include: saleInclude,
    });
  }

  findByNumber(saleNumber: string): Promise<SaleWithRelations | null> {
    return this.prisma.sale.findFirst({
      where: { saleNumber, deletedAt: null },
      include: saleInclude,
    });
  }

  findAnyNumber(saleNumber: string): Promise<Sale | null> {
    return this.prisma.sale.findUnique({ where: { saleNumber } });
  }

  async list(input: {
    where: Prisma.SaleWhereInput;
    orderBy: Prisma.SaleOrderByWithRelationInput;
    offset: number;
    limit: number;
  }) {
    const [rows, total] = await Promise.all([
      this.prisma.sale.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
        include: saleInclude,
      }),
      this.prisma.sale.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  async nextSequence(prefix: string, tx?: Prisma.TransactionClient): Promise<number> {
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

  async transitionStatus(
    tx: Prisma.TransactionClient,
    input: {
      saleId: string;
      from: string;
      to: string;
      action: string;
      reason?: string | null;
      userId?: string | null;
      username?: string | null;
      extra?: Prisma.SaleUncheckedUpdateInput;
    },
  ): Promise<SaleWithRelations | null> {
    const result = await tx.sale.updateMany({
      where: {
        id: input.saleId,
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
    await tx.saleHistory.create({
      data: {
        saleId: input.saleId,
        oldStatus: input.from,
        newStatus: input.to,
        action: input.action,
        reason: input.reason ?? null,
        userId: input.userId ?? null,
        username: input.username ?? null,
      },
    });
    return tx.sale.findUniqueOrThrow({
      where: { id: input.saleId },
      include: saleInclude,
    });
  }

  async updateCustomerInTx(
    tx: Prisma.TransactionClient,
    saleId: string,
    customerId: string | null,
    userId?: string | null,
  ): Promise<void> {
    await tx.sale.update({
      where: { id: saleId },
      data: {
        customerId,
        updatedBy: userId ?? null,
      },
    });
  }
}
