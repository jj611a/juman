import { Injectable } from '@nestjs/common';
import type { Item, ItemStateHistory, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { liveWhere } from '../../shared/soft-delete/soft-delete';

@Injectable()
export class LifecycleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLiveItem(id: string): Promise<Item | null> {
    return this.prisma.item.findFirst({ where: liveWhere({ id }) });
  }

  history(itemId: string, offset: number, limit: number): Promise<{
    rows: ItemStateHistory[];
    total: number;
  }> {
    const where: Prisma.ItemStateHistoryWhereInput = { itemId };
    return Promise.all([
      this.prisma.itemStateHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.itemStateHistory.count({ where }),
    ]).then(([rows, total]) => ({ rows, total }));
  }

  /**
   * CAS transition: updates only if current lifecycleState still matches `from`.
   * Prevents concurrent conflicting transitions.
   */
  async transitionAtomic(input: {
    itemId: string;
    from: string;
    to: string;
    reason: string | null;
    userId: string | null;
    username: string | null;
    referenceType: string | null;
    referenceId: string | null;
    updatedBy: string | null;
  }): Promise<{ item: Item; history: ItemStateHistory } | null> {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.item.updateMany({
        where: {
          id: input.itemId,
          deletedAt: null,
          lifecycleState: input.from,
        },
        data: {
          lifecycleState: input.to,
          updatedBy: input.updatedBy,
        },
      });
      if (result.count !== 1) return null;

      const history = await tx.itemStateHistory.create({
        data: {
          itemId: input.itemId,
          oldState: input.from,
          newState: input.to,
          reason: input.reason,
          userId: input.userId,
          username: input.username,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
        },
      });
      const item = await tx.item.findUniqueOrThrow({ where: { id: input.itemId } });
      return { item, history };
    });
  }

  createHistory(data: Prisma.ItemStateHistoryUncheckedCreateInput): Promise<ItemStateHistory> {
    return this.prisma.itemStateHistory.create({ data });
  }
}
