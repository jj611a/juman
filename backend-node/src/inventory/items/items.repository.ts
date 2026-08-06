import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { BARCODE_STATUS } from '../../shared/constants/business.constants';
import { PrismaService } from '../../database/prisma.service';
import type { TaxonomyKind } from '../inventory.types';
import {
  softDeleteData,
  restoreSoftDeleteData,
} from '../../shared/soft-delete/soft-delete';
import {
  INVENTORY_MODULE,
  ITEM_ENTITY,
  ITEM_LIFECYCLE_DEFAULT,
  ITEM_STATUS,
} from '../inventory.constants';

export const itemInclude = {
  category: true,
  brand: true,
  color: true,
  size: true,
  barcodes: { where: { deletedAt: null }, include: { barcode: true } },
} satisfies Prisma.ItemInclude;

export type ItemMediaAttachment = {
  id: string;
  mediaFileId: string;
  purpose: string;
  isPrimary: boolean;
  displayOrder: number;
  mediaFile: {
    id: string;
    originalFilename: string;
    mimeType: string;
    relativePath: string;
  };
};

@Injectable()
export class ItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ItemUncheckedCreateInput) {
    return this.prisma.item.create({ data, include: itemInclude });
  }

  /**
   * Atomically persist item + optional barcode binding + media refs + birth history.
   * Barcode row must already exist as reserved (platform allocate); activation is in-TX.
   */
  async createAtomic(input: {
    item: Prisma.ItemUncheckedCreateInput;
    barcodeId?: string | null;
    media?: Array<{
      mediaFileId: string;
      purpose: string;
      displayOrder: number;
      isPrimary: boolean;
      createdBy?: string | null;
    }>;
    actorId?: string | null;
    username?: string | null;
  }) {
    const itemId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.item.create({ data: input.item });
      if (input.barcodeId) {
        await tx.barcode.update({
          where: { id: input.barcodeId },
          data: {
            status: BARCODE_STATUS.ACTIVATED,
            entityType: ITEM_ENTITY,
            entityId: created.id,
            activatedAt: new Date(),
            updatedBy: input.actorId ?? null,
          },
        });
        await tx.itemBarcode.create({
          data: {
            itemId: created.id,
            barcodeId: input.barcodeId,
            isPrimary: true,
            createdBy: input.actorId ?? null,
          },
        });
      }
      for (const m of input.media ?? []) {
        await tx.mediaReference.create({
          data: {
            mediaFileId: m.mediaFileId,
            moduleName: INVENTORY_MODULE,
            entityType: ITEM_ENTITY,
            entityId: created.id,
            purpose: m.purpose,
            displayOrder: m.displayOrder,
            isPrimary: m.isPrimary,
            createdBy: m.createdBy ?? null,
          },
        });
      }
      await tx.itemStateHistory.create({
        data: {
          itemId: created.id,
          oldState: ITEM_LIFECYCLE_DEFAULT,
          newState: ITEM_LIFECYCLE_DEFAULT,
          reason: 'created',
          userId: input.actorId ?? null,
          username: input.username ?? null,
        },
      });
      return created.id;
    });
    return this.findById(itemId);
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

  /** Soft-delete item + release barcodes + soft-delete ItemBarcode + MediaReference. */
  async softDeleteCascade(id: string, userId?: string) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findFirst({ where: { id, deletedAt: null } });
      if (!item) return;
      await tx.item.update({
        where: { id },
        data: {
          deletedAt: now,
          deletedBy: userId ?? null,
          statusBeforeDelete: item.status,
          status: ITEM_STATUS.INACTIVE,
        },
      });
      const links = await tx.itemBarcode.findMany({
        where: { itemId: id, deletedAt: null },
        include: { barcode: true },
      });
      for (const link of links) {
        await tx.itemBarcode.update({
          where: { id: link.id },
          data: softDeleteData(now),
        });
        if (link.barcode.status === BARCODE_STATUS.ACTIVATED) {
          await tx.barcode.update({
            where: { id: link.barcodeId },
            data: {
              status: BARCODE_STATUS.RESERVED,
              entityType: null,
              entityId: null,
              activatedAt: null,
              updatedBy: userId ?? null,
            },
          });
        }
      }
      await tx.mediaReference.updateMany({
        where: {
          moduleName: INVENTORY_MODULE,
          entityType: ITEM_ENTITY,
          entityId: id,
          deletedAt: null,
        },
        data: softDeleteData(now),
      });
    });
    return this.findById(id, true);
  }

  /** Restore item status/lifecycle relations: barcodes re-activated, media refs revived. */
  async restoreCascade(id: string, userId?: string) {
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findFirst({
        where: { id, deletedAt: { not: null } },
      });
      if (!item) return;
      const restoredStatus =
        item.statusBeforeDelete &&
        item.statusBeforeDelete !== ITEM_STATUS.INACTIVE
          ? item.statusBeforeDelete
          : ITEM_STATUS.ACTIVE;
      await tx.item.update({
        where: { id },
        data: {
          ...restoreSoftDeleteData(),
          deletedBy: null,
          updatedBy: userId ?? null,
          status: restoredStatus,
          statusBeforeDelete: null,
        },
      });
      const links = await tx.itemBarcode.findMany({
        where: { itemId: id, deletedAt: { not: null } },
      });
      for (const link of links) {
        await tx.itemBarcode.update({
          where: { id: link.id },
          data: restoreSoftDeleteData(),
        });
        await tx.barcode.update({
          where: { id: link.barcodeId },
          data: {
            status: BARCODE_STATUS.ACTIVATED,
            entityType: ITEM_ENTITY,
            entityId: id,
            activatedAt: new Date(),
            updatedBy: userId ?? null,
          },
        });
      }
      await tx.mediaReference.updateMany({
        where: {
          moduleName: INVENTORY_MODULE,
          entityType: ITEM_ENTITY,
          entityId: id,
          deletedAt: { not: null },
        },
        data: restoreSoftDeleteData(),
      });
    });
    return this.findById(id);
  }

  softDelete(id: string, userId?: string) {
    return this.softDeleteCascade(id, userId);
  }

  restore(id: string, userId?: string) {
    return this.restoreCascade(id, userId);
  }

  findTaxonomy(kind: TaxonomyKind, id: string) {
    const where = { id, deletedAt: null };
    switch (kind) {
      case 'category':
        return this.prisma.category.findFirst({ where });
      case 'brand':
        return this.prisma.brand.findFirst({ where });
      case 'color':
        return this.prisma.color.findFirst({ where });
      case 'size':
        return this.prisma.size.findFirst({ where });
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

  /**
   * Activate a reserved platform barcode and bind it as item primary.
   * Caller must ensure the item has no live ItemBarcode rows.
   */
  async attachBarcodeAtomic(
    itemId: string,
    barcodeId: string,
    userId?: string | null,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.barcode.update({
        where: { id: barcodeId },
        data: {
          status: BARCODE_STATUS.ACTIVATED,
          entityType: ITEM_ENTITY,
          entityId: itemId,
          activatedAt: new Date(),
          updatedBy: userId ?? null,
        },
      });
      await tx.itemBarcode.create({
        data: {
          itemId,
          barcodeId,
          isPrimary: true,
          createdBy: userId ?? null,
        },
      });
    });
    return this.findById(itemId);
  }

  async listMediaForItem(itemId: string): Promise<ItemMediaAttachment[]> {
    const refs = await this.prisma.mediaReference.findMany({
      where: {
        moduleName: INVENTORY_MODULE,
        entityType: ITEM_ENTITY,
        entityId: itemId,
        deletedAt: null,
      },
      include: {
        mediaFile: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            relativePath: true,
          },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return refs.map((r) => ({
      id: r.id,
      mediaFileId: r.mediaFileId,
      purpose: r.purpose,
      isPrimary: r.isPrimary,
      displayOrder: r.displayOrder,
      mediaFile: r.mediaFile,
    }));
  }

  async listMediaForItems(
    itemIds: string[],
  ): Promise<Map<string, ItemMediaAttachment[]>> {
    const map = new Map<string, ItemMediaAttachment[]>();
    if (itemIds.length === 0) return map;
    const refs = await this.prisma.mediaReference.findMany({
      where: {
        moduleName: INVENTORY_MODULE,
        entityType: ITEM_ENTITY,
        entityId: { in: itemIds },
        deletedAt: null,
      },
      include: {
        mediaFile: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            relativePath: true,
          },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    for (const r of refs) {
      const list = map.get(r.entityId) ?? [];
      list.push({
        id: r.id,
        mediaFileId: r.mediaFileId,
        purpose: r.purpose,
        isPrimary: r.isPrimary,
        displayOrder: r.displayOrder,
        mediaFile: r.mediaFile,
      });
      map.set(r.entityId, list);
    }
    return map;
  }
}
