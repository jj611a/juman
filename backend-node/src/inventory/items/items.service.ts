import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { BarcodeService } from '../../barcode/barcode.service';
import { MediaService } from '../../media/media.service';
import { SettingsService } from '../../settings/settings.service';
import { AUDIT_ACTION } from '../../shared/constants/business.constants';
import { BusinessException } from '../../shared/errors/business.exception';
import { assertFils, assertNonNegativeFils } from '../../shared/money/money';
import {
  normalizePagination,
  paginated,
} from '../../shared/pagination/pagination';
import { normalizeSearchQuery } from '../../shared/search/search';
import { normalizeSort } from '../../shared/sorting/sorting';
import { parseOptionalBoolean } from '../../shared/validation/parse-boolean';
import type { AuthPrincipal } from '../../shared/types';
import {
  INVENTORY_ITEM_SETTING,
  ITEM_CONDITION,
  ITEM_DEFAULT_PADDING,
  ITEM_DEFAULT_PREFIX,
  ITEM_DEFAULT_SEPARATOR,
  ITEM_ENTITY,
  ITEM_LIFECYCLE_DEFAULT,
  ITEM_SORT_FIELDS,
  ITEM_STATUS,
  INVENTORY_MODULE,
} from '../inventory.constants';
import type {
  AttachItemMediaPayload,
  ItemPayload,
  ItemWithRelations,
  ListItemsQuery,
  TaxonomyKind,
} from '../inventory.types';
import { toItemPublic } from './items.mapper';
import { ItemsRepository } from './items.repository';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { isEditable } from '../lifecycle/lifecycle.rules';
@Injectable()
export class ItemsService {
  constructor(
    private readonly repo: ItemsRepository,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly barcode: BarcodeService,
    private readonly media: MediaService,
    private readonly lifecycle: LifecycleService,
  ) {}
  async create(dto: ItemPayload, actor?: AuthPrincipal) {
    const item = await this.repo.create(
      (await this.data(dto, actor, true)) as Prisma.ItemUncheckedCreateInput,
    );
    try {
      if (dto.barcode?.trim() || dto.generateBarcode) {
        const b = dto.barcode?.trim()
          ? await this.barcode.reserve(
              { value: dto.barcode, createdBy: actor?.userId },
              actor,
            )
          : await this.barcode.generate({ createdBy: actor?.userId }, actor);
        await this.barcode.activate(b.id, ITEM_ENTITY, item.id, actor);
        await this.repo.createBarcode(item.id, b.id, true, actor?.userId);
      }
      await this.lifecycle.recordCreated(item.id, actor);
      const row = await this.getById(item.id);
      await this.audit.recordCreate(
        INVENTORY_MODULE,
        ITEM_ENTITY,
        row.id,
        this.snapshot(row),
        { userId: actor?.userId, username: actor?.username },
      );
      return toItemPublic(row);
    } catch (e) {
      await this.repo.softDelete(item.id, actor?.userId);
      throw e;
    }
  }
  async update(id: string, dto: ItemPayload, actor?: AuthPrincipal) {
    const old = await this.live(id);
    if (
      !isEditable({
        deletedAt: old.deletedAt,
        status: old.status,
        lifecycleState: old.lifecycleState,
      })
    ) {
      throw BusinessException.conflict(
        'Item catalog fields are not editable in the current lifecycle state',
      );
    }
    const row = await this.repo.update(
      id,
      (await this.data(dto, actor, false)) as Prisma.ItemUncheckedUpdateInput,
    );
    await this.audit.recordUpdate(
      INVENTORY_MODULE,
      ITEM_ENTITY,
      id,
      this.snapshot(old),
      this.snapshot(row),
      { userId: actor?.userId, username: actor?.username },
    );
    return toItemPublic(row);
  }
  async softDelete(id: string, actor?: AuthPrincipal) {
    const old = await this.live(id);
    const row = await this.repo.softDelete(id, actor?.userId);
    await this.audit.recordSoftDelete(
      INVENTORY_MODULE,
      ITEM_ENTITY,
      id,
      this.snapshot(old),
      { userId: actor?.userId, username: actor?.username },
    );
    return toItemPublic(row);
  }
  async restore(id: string, actor?: AuthPrincipal) {
    const old = await this.repo.findById(id, true);
    if (!old) throw BusinessException.notFound('Item not found');
    if (!old.deletedAt) throw BusinessException.conflict('Item is not deleted');
    const row = await this.repo.restore(id, actor?.userId);
    await this.audit.record({
      module: INVENTORY_MODULE,
      entityType: ITEM_ENTITY,
      entityId: id,
      action: AUDIT_ACTION.RESTORE,
      oldValues: this.snapshot(old),
      newValues: this.snapshot(row),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return toItemPublic(row);
  }
  async getById(id: string) {
    return this.live(id);
  }
  async getPublicById(id: string) {
    return toItemPublic(await this.live(id));
  }
  async getByInternalCode(code: string) {
    const r = await this.repo.findByCode(code.trim().toUpperCase());
    if (!r) throw BusinessException.notFound('Item not found');
    return toItemPublic(r);
  }
  async list(query: ListItemsQuery) {
    const page = normalizePagination(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(ITEM_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const { rows, total } = await this.repo.list({
      where: this.where(query),
      orderBy: { [sort.field]: sort.direction },
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows.map(toItemPublic), total, page);
  }
  async search(q: ListItemsQuery) {
    if (!normalizeSearchQuery(q.q))
      throw BusinessException.validation('Search query q is required');
    return this.list(q);
  }
  async attachMedia(id: string, dto: AttachItemMediaPayload, actor?: AuthPrincipal) {
    await this.live(id);
    await this.media.find(dto.mediaFileId);
    await this.media.attach({
      mediaFileId: dto.mediaFileId,
      moduleName: INVENTORY_MODULE,
      entityType: ITEM_ENTITY,
      entityId: id,
      purpose: dto.purpose ?? 'gallery',
      displayOrder: dto.displayOrder ?? 0,
      isPrimary: dto.isPrimary ?? false,
      createdBy: actor?.userId,
    });
    return this.repo.createMedia({
      itemId: id,
      mediaFileId: dto.mediaFileId,
      purpose: dto.purpose ?? 'gallery',
      displayOrder: dto.displayOrder ?? 0,
      isPrimary: dto.isPrimary ?? false,
      createdBy: actor?.userId ?? null,
    });
  }
  private where(q: ListItemsQuery): Prisma.ItemWhereInput {
    const w: Prisma.ItemWhereInput = {
      deletedAt:
        parseOptionalBoolean(q.deleted) === true ? { not: null } : null,
    };
    if (q.categoryId) w.categoryId = q.categoryId;
    if (q.brandId) w.brandId = q.brandId;
    if (q.colorId) w.colorId = q.colorId;
    if (q.sizeId) w.sizeId = q.sizeId;
    if (q.status) w.status = this.status(q.status);
    if (q.lifecycleState) {
      const ls = q.lifecycleState.trim().toLowerCase();
      w.lifecycleState = ls;
    }
    const text = normalizeSearchQuery(q.q);
    if (text)
      w.OR = [
        { displayName: { contains: text } },
        { internalCode: { contains: text.toUpperCase() } },
        {
          barcodes: {
            some: { deletedAt: null, barcode: { code: { contains: text } } },
          },
        },
      ];
    if (q.displayName) w.displayName = { contains: q.displayName.trim() };
    if (q.internalCode)
      w.internalCode = { contains: q.internalCode.trim().toUpperCase() };
    if (q.barcode)
      w.barcodes = {
        some: {
          deletedAt: null,
          barcode: { code: { contains: q.barcode.trim() } },
        },
      };
    return w;
  }
  private async data(
    d: ItemPayload,
    a: AuthPrincipal | undefined,
    create: boolean,
  ): Promise<Prisma.ItemUncheckedCreateInput | Prisma.ItemUncheckedUpdateInput> {
    const x: Prisma.ItemUncheckedCreateInput | Prisma.ItemUncheckedUpdateInput = {
      updatedBy: a?.userId ?? null,
    };
    if (create) {
      x.internalCode = await this.code();
      x.displayName = this.name(d.displayName);
      x.purchasePrice = this.money(d.purchasePrice ?? 0, 'purchasePrice');
      x.rentalPrice = this.money(d.rentalPrice ?? 0, 'rentalPrice');
      x.salePrice = this.money(d.salePrice ?? 0, 'salePrice');
      x.status = this.status(d.status ?? ITEM_STATUS.DRAFT);
      x.lifecycleState = ITEM_LIFECYCLE_DEFAULT;
      if (d.condition !== undefined) {
        x.condition = this.condition(d.condition);
      }
      x.createdBy = a?.userId ?? null;
    } else {
      if (d.displayName !== undefined) x.displayName = this.name(d.displayName);
      if (d.description !== undefined) x.description = d.description.trim() || null;
      if (d.purchasePrice !== undefined)
        x.purchasePrice = this.money(d.purchasePrice, 'purchasePrice');
      if (d.rentalPrice !== undefined)
        x.rentalPrice = this.money(d.rentalPrice, 'rentalPrice');
      if (d.salePrice !== undefined) x.salePrice = this.money(d.salePrice, 'salePrice');
      if (d.status !== undefined) x.status = this.status(d.status);
      if (d.condition !== undefined) x.condition = this.condition(d.condition);
    }
    const taxonomies = {
      categoryId: 'category',
      brandId: 'brand',
      colorId: 'color',
      sizeId: 'size',
    } as const;
    for (const [field, kind] of Object.entries(taxonomies) as [keyof typeof taxonomies, TaxonomyKind][]) {
      const value = d[field];
      if (value !== undefined) {
        Object.assign(x, { [field]: value || null });
        if (value && !(await this.repo.findTaxonomy(kind, value)))
          throw BusinessException.validation(
            `${field} must reference a live taxonomy`,
          );
      }
    }
    return x;
  }
  private name(v: unknown) {
    const s = String(v ?? '').trim();
    if (!s) throw BusinessException.validation('displayName is required');
    return s;
  }
  private money(v: unknown, f: string) {
    return assertNonNegativeFils(assertFils(v, f), f);
  }
  private status(v: string) {
    const x = v.toLowerCase();
    if (!Object.values(ITEM_STATUS).includes(x as never))
      throw BusinessException.validation('Invalid item status');
    return x;
  }
  private condition(v: unknown) {
    if (v == null || v === '') return null;
    const x = String(v).toLowerCase();
    if (!Object.values(ITEM_CONDITION).includes(x as never))
      throw BusinessException.validation('Invalid item condition');
    return x;
  }
  private async code() {
    const prefix = (
      await this.settings.getString(
        INVENTORY_ITEM_SETTING.PREFIX,
        ITEM_DEFAULT_PREFIX,
      )
    )
      .trim()
      .toUpperCase();
    const separator = await this.settings.getString(
      INVENTORY_ITEM_SETTING.SEPARATOR,
      ITEM_DEFAULT_SEPARATOR,
    );
    const padding = await this.settings.getInt(
      INVENTORY_ITEM_SETTING.PADDING,
      ITEM_DEFAULT_PADDING,
    );

    if (
      !/^[A-Z0-9]+$/.test(prefix) ||
      !Number.isInteger(padding) ||
      padding < 1 ||
      padding > 16
    ) {
      throw BusinessException.validation(
        'Invalid inventory item code settings',
      );
    }

    for (let i = 0; i < 25; i += 1) {
      const sequence = await this.repo.nextSequence(`item:${prefix}`);
      const code = `${prefix}${separator}${String(sequence).padStart(padding, '0')}`;
      if (!(await this.repo.findAnyCode(code))) {
        return code;
      }
    }

    throw BusinessException.invariant('Unable to allocate item code');
  }
  private async live(id: string) {
    const r = await this.repo.findById(id);
    if (!r) throw BusinessException.notFound('Item not found');
    return r;
  }
  private snapshot(r: ItemWithRelations) {
    return {
      id: r.id,
      internalCode: r.internalCode,
      displayName: r.displayName,
      status: r.status,
      lifecycleState: r.lifecycleState,
      condition: r.condition,
      deletedAt: r.deletedAt,
    };
  }
}
