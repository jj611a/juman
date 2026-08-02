import { Injectable } from '@nestjs/common';
import type { Barcode, Prisma, SequenceCounter } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { liveWhere } from '../shared/soft-delete/soft-delete';

@Injectable()
export class BarcodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Barcode | null> {
    return this.prisma.barcode.findFirst({ where: liveWhere({ id }) });
  }

  findByCode(code: string): Promise<Barcode | null> {
    return this.prisma.barcode.findFirst({ where: liveWhere({ code }) });
  }

  /** Uniqueness includes soft-deleted / retired rows (lifetime uniqueness). */
  findAnyByCode(code: string): Promise<Barcode | null> {
    return this.prisma.barcode.findUnique({ where: { code } });
  }

  create(data: Prisma.BarcodeCreateInput): Promise<Barcode> {
    return this.prisma.barcode.create({ data });
  }

  update(id: string, data: Prisma.BarcodeUpdateInput): Promise<Barcode> {
    return this.prisma.barcode.update({ where: { id }, data });
  }

  async list(input: {
    where: Prisma.BarcodeWhereInput;
    orderBy: Prisma.BarcodeOrderByWithRelationInput;
    offset: number;
    limit: number;
  }): Promise<{ rows: Barcode[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.prisma.barcode.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
      }),
      this.prisma.barcode.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  async nextSequence(prefix: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.sequenceCounter.findUnique({ where: { prefix } });
      if (!existing) {
        await tx.sequenceCounter.create({ data: { prefix, lastValue: 1 } });
        return 1;
      }
      const updated = await tx.sequenceCounter.update({
        where: { prefix },
        data: { lastValue: existing.lastValue + 1 },
      });
      return updated.lastValue;
    });
  }

  bumpSequenceAtLeast(prefix: string, minValue: number): Promise<SequenceCounter> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.sequenceCounter.findUnique({ where: { prefix } });
      if (!existing) {
        return tx.sequenceCounter.create({
          data: { prefix, lastValue: minValue },
        });
      }
      if (existing.lastValue >= minValue) return existing;
      return tx.sequenceCounter.update({
        where: { prefix },
        data: { lastValue: minValue },
      });
    });
  }
}
