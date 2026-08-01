import { Injectable } from '@nestjs/common';
import type { Barcode, SequenceCounter } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { liveWhere } from '../shared/soft-delete/soft-delete';

@Injectable()
export class BarcodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCode(code: string): Promise<Barcode | null> {
    return this.prisma.barcode.findFirst({ where: liveWhere({ code }) });
  }

  /** Uniqueness includes soft-deleted rows (lifetime uniqueness). */
  findAnyByCode(code: string): Promise<Barcode | null> {
    return this.prisma.barcode.findUnique({ where: { code } });
  }

  create(data: {
    code: string;
    prefix: string;
    status: string;
    entityType: string | null;
    entityId: string | null;
    reservedAt: Date | null;
    allocatedAt: Date | null;
    createdBy: string | null;
  }): Promise<Barcode> {
    return this.prisma.barcode.create({ data });
  }

  updateStatus(
    id: string,
    data: {
      status: string;
      entityType?: string | null;
      entityId?: string | null;
      allocatedAt?: Date | null;
      releasedAt?: Date | null;
      updatedBy?: string | null;
    },
  ): Promise<Barcode> {
    return this.prisma.barcode.update({ where: { id }, data });
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