import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { TaxonomyKind } from '../inventory.types';
import {
  softDeleteData,
  restoreSoftDeleteData,
} from '../../shared/soft-delete/soft-delete';
export const itemInclude = {
  category: true,
  brand: true,
  color: true,
  size: true,
  barcodes: { where: { deletedAt: null }, include: { barcode: true } },
  media: {
    where: { deletedAt: null },
    include: { mediaFile: true },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.ItemInclude;
@Injectable()
export class ItemsRepository {
  constructor(private readonly prisma: PrismaService) {}
  create(data: Prisma.ItemUncheckedCreateInput) {
    return this.prisma.item.create({ data, include: itemInclude });
  }
  update(id: string, data: Prisma.ItemUncheckedUpdateInput) {
    return this.prisma.item.update({ where: { id }, data, include: itemInclude });
  }
  findById(id: string, deleted = false) {
    return this.prisma.item.findFirst({
      where: { id, deletedAt: deleted ? { not: null } : null },
      include: itemInclude,
    });
  }
  findByCode(internalCode: string) {
    return this.prisma.item.findFirst({
      where: { internalCode, deletedAt: null },
      include: itemInclude,
    });
  }
  findAnyCode(internalCode: string) {
    return this.prisma.item.findUnique({ where: { internalCode } });
  }
  async list(input: {
    where: Prisma.ItemWhereInput;
    orderBy: Prisma.ItemOrderByWithRelationInput;
    offset: number;
    limit: number;
  }) {
    const [rows, total] = await Promise.all([
      this.prisma.item.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
        include: itemInclude,
      }),
      this.prisma.item.count({ where: input.where }),
    ]);
    return { rows, total };
  }
  async nextSequence(prefix: string) {
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
  softDelete(id: string, userId?: string) {
    return this.update(id, {
      ...softDeleteData(),
      deletedBy: userId ?? null,
      status: 'inactive',
    });
  }
  restore(id: string, userId?: string) {
    return this.update(id, {
      ...restoreSoftDeleteData(),
      deletedBy: null,
      updatedBy: userId ?? null,
    });
  }
  findTaxonomy(kind: TaxonomyKind, id: string) {
    const where = { id, deletedAt: null };
    switch (kind) {
      case 'category': return this.prisma.category.findFirst({ where });
      case 'brand': return this.prisma.brand.findFirst({ where });
      case 'color': return this.prisma.color.findFirst({ where });
      case 'size': return this.prisma.size.findFirst({ where });
    }
  }
  createBarcode(
    itemId: string,
    barcodeId: string,
    isPrimary: boolean,
    userId?: string,
  ) {
    return this.prisma.itemBarcode.create({
      data: { itemId, barcodeId, isPrimary, createdBy: userId ?? null },
    });
  }
  createMedia(data: Prisma.ItemMediaUncheckedCreateInput) {
    return this.prisma.itemMedia.create({ data, include: { mediaFile: true } });
  }
}
