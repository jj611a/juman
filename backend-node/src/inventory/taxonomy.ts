import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { AUDIT_ACTION } from '../shared/constants/business.constants';
import { BusinessException } from '../shared/errors/business.exception';
import { normalizePagination, paginated } from '../shared/pagination/pagination';
import type { AuthPrincipal } from '../shared/types';
import type {
  ListTaxonomyQuery,
  TaxonomyKind,
  TaxonomyPayload,
  TaxonomyRow,
} from './inventory.types';

type TaxonomyMutationInput = TaxonomyPayload & {
  updatedBy?: string | null;
  deletedAt?: Date | null;
  deletedBy?: string | null;
};
type TaxonomyWhereInput = {
  deletedAt: Date | null | { not: null };
  name?: Prisma.StringFilter;
  parentId?: string | null;
};

@Injectable()
export class TaxonomyRepository {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly kind: TaxonomyKind,
  ) {}
  create(data: TaxonomyMutationInput) {
    switch (this.kind) {
      case 'category':
        return this.prisma.category.create({ data: data as Prisma.CategoryUncheckedCreateInput });
      case 'brand':
        return this.prisma.brand.create({ data: data as Prisma.BrandUncheckedCreateInput });
      case 'color':
        return this.prisma.color.create({ data: data as Prisma.ColorUncheckedCreateInput });
      case 'size':
        return this.prisma.size.create({ data: data as Prisma.SizeUncheckedCreateInput });
    }
  }
  update(id: string, data: TaxonomyMutationInput) {
    switch (this.kind) {
      case 'category':
        return this.prisma.category.update({ where: { id }, data: data as Prisma.CategoryUncheckedUpdateInput });
      case 'brand':
        return this.prisma.brand.update({ where: { id }, data: data as Prisma.BrandUncheckedUpdateInput });
      case 'color':
        return this.prisma.color.update({ where: { id }, data: data as Prisma.ColorUncheckedUpdateInput });
      case 'size':
        return this.prisma.size.update({ where: { id }, data: data as Prisma.SizeUncheckedUpdateInput });
    }
  }
  find(id: string, deleted = false) {
    const where = { id, deletedAt: deleted ? { not: null } : null };
    switch (this.kind) {
      case 'category': return this.prisma.category.findFirst({ where });
      case 'brand': return this.prisma.brand.findFirst({ where });
      case 'color': return this.prisma.color.findFirst({ where });
      case 'size': return this.prisma.size.findFirst({ where });
    }
  }
  async findAnyName(name: string, excludeId?: string) {
    const where = { deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) };
    const select = { id: true, name: true };
    const rows = await (this.kind === 'category'
      ? this.prisma.category.findMany({ where, select })
      : this.kind === 'brand'
        ? this.prisma.brand.findMany({ where, select })
        : this.kind === 'color'
          ? this.prisma.color.findMany({ where, select })
          : this.prisma.size.findMany({ where, select }));
    return (
      rows.find(
        (r) =>
          r.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
      ) ?? null
    );
  }
  async list(where: TaxonomyWhereInput, skip: number, take: number) {
    switch (this.kind) {
      case 'category': {
        const typedWhere = where as Prisma.CategoryWhereInput;
        const [rows, total] = await Promise.all([this.prisma.category.findMany({ where: typedWhere, skip, take, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }), this.prisma.category.count({ where: typedWhere })]);
        return { rows, total };
      }
      case 'brand': {
        const typedWhere = where as Prisma.BrandWhereInput;
        const [rows, total] = await Promise.all([this.prisma.brand.findMany({ where: typedWhere, skip, take, orderBy: [{ name: 'asc' }] }), this.prisma.brand.count({ where: typedWhere })]);
        return { rows, total };
      }
      case 'color': {
        const typedWhere = where as Prisma.ColorWhereInput;
        const [rows, total] = await Promise.all([this.prisma.color.findMany({ where: typedWhere, skip, take, orderBy: [{ name: 'asc' }] }), this.prisma.color.count({ where: typedWhere })]);
        return { rows, total };
      }
      case 'size': {
        const typedWhere = where as Prisma.SizeWhereInput;
        const [rows, total] = await Promise.all([this.prisma.size.findMany({ where: typedWhere, skip, take, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }), this.prisma.size.count({ where: typedWhere })]);
        return { rows, total };
      }
    }
  }
  softDelete(id: string, userId?: string) {
    return this.update(id, {
      deletedAt: new Date(),
      deletedBy: userId ?? null,
      isActive: false,
    });
  }
  restore(id: string, userId?: string) {
    return this.update(id, {
      deletedAt: null,
      deletedBy: null,
      isActive: true,
      updatedBy: userId ?? null,
    });
  }
}
@Injectable()
export class TaxonomyService {
  constructor(
    protected readonly repo: TaxonomyRepository,
    protected readonly audit: AuditService,
    protected readonly kind: TaxonomyKind,
  ) {}
  async create(dto: TaxonomyPayload, actor?: AuthPrincipal) {
    const data = this.data(dto, actor);
    if (!data.name) throw BusinessException.validation('name is required');
    await this.unique(data.name);
    if (this.kind === 'category' && data.parentId)
      await this.live(data.parentId);
    const row = await this.repo.create(data);
    await this.audit.recordCreate('inventory', this.kind, row.id, row, {
      userId: actor?.userId,
      username: actor?.username,
    });
    return row;
  }
  async update(id: string, dto: TaxonomyPayload, actor?: AuthPrincipal) {
    const old = await this.live(id);
    const data = this.data(dto, actor);
    if (data.name !== undefined) await this.unique(data.name, id);
    if (this.kind === 'category' && data.parentId) {
      if (data.parentId === id)
        throw BusinessException.validation('Category cannot be its own parent');
      await this.live(data.parentId);
    }
    const row = await this.repo.update(id, data);
    await this.audit.recordUpdate('inventory', this.kind, id, old, row, {
      userId: actor?.userId,
      username: actor?.username,
    });
    return row;
  }
  async list(q: ListTaxonomyQuery) {
    const deleted = q.deleted === 'true' || q.deleted === true;
    const where: TaxonomyWhereInput = { deletedAt: deleted ? { not: null } : null };
    if (q.q?.trim()) where.name = { contains: q.q.trim() };
    if (q.parentId !== undefined && this.kind === 'category') {
      where.parentId = q.parentId || null;
    }

    const page = normalizePagination(q);
    const { rows, total } = await this.repo.list(
      where,
      page.offset,
      page.limit,
    );
    return paginated<TaxonomyRow>(rows, total, page);
  }
  async getById(id: string) {
    return this.live(id);
  }
  async softDelete(id: string, actor?: AuthPrincipal) {
    const old = await this.live(id);
    const row = await this.repo.softDelete(id, actor?.userId);
    await this.audit.recordSoftDelete('inventory', this.kind, id, old, {
      userId: actor?.userId,
      username: actor?.username,
    });
    return row;
  }
  async restore(id: string, actor?: AuthPrincipal) {
    const old = await this.repo.find(id, true);
    if (!old) throw BusinessException.notFound(`${this.kind} not found`);
    if (!old.deletedAt)
      throw BusinessException.conflict(`${this.kind} is not deleted`);
    await this.unique(old.name, id);
    const row = await this.repo.restore(id, actor?.userId);
    await this.audit.record({
      module: 'inventory',
      entityType: this.kind,
      entityId: id,
      action: AUDIT_ACTION.RESTORE,
      oldValues: old,
      newValues: row,
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return row;
  }
  protected async live(id: string) {
    const r = await this.repo.find(id);
    if (!r) throw BusinessException.notFound(`${this.kind} not found`);
    return r;
  }
  protected async unique(name: string, excludeId?: string) {
    if (await this.repo.findAnyName(name, excludeId))
      throw BusinessException.conflict(
        `A live ${this.kind} with this name already exists`,
      );
  }
  protected data(dto: TaxonomyPayload, actor?: AuthPrincipal): TaxonomyMutationInput {
    const name = dto.name === undefined ? undefined : dto.name.trim();
    if (name !== undefined) {
      if (!name) throw BusinessException.validation('name is required');
    }
    const base = {
      ...(name !== undefined ? { name } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      updatedBy: actor?.userId ?? null,
    };
    if (this.kind === 'category') {
      return {
        ...base,
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn?.trim() || null } : {}),
      };
    }
    if (this.kind === 'size') {
      return { ...base, ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}) };
    }
    if (this.kind === 'color' && dto.hexCode !== undefined) {
      const hex = (dto.hexCode ?? '').trim().toUpperCase();
      if (hex && !/^#[0-9A-F]{6}$/.test(hex))
        throw BusinessException.validation('hexCode must be #RRGGBB');
      return { ...base, hexCode: hex || null };
    }
    return base;
  }
}
