import { Injectable } from '@nestjs/common';
import type { Customer, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { AUDIT_ACTION } from '../shared/constants/business.constants';
import { BusinessException } from '../shared/errors/business.exception';
import {
  normalizePagination,
  paginated,
  type Paginated,
  type PaginationInput,
} from '../shared/pagination/pagination';
import { normalizeSearchQuery } from '../shared/search/search';
import { normalizeSort } from '../shared/sorting/sorting';
import { optionalNormalizePhone, normalizePhone } from '../shared/phone/phone';
import { assertNonEmptyString } from '../shared/validation/assert';
import { parseOptionalBoolean } from '../shared/validation/parse-boolean';
import type { AuthPrincipal } from '../shared/types';
import {
  CUSTOMER_DEFAULT_PADDING,
  CUSTOMER_DEFAULT_PREFIX,
  CUSTOMER_DEFAULT_SEPARATOR,
  CUSTOMER_ENTITY,
  CUSTOMER_GENDER,
  CUSTOMER_MODULE,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NATIONAL_ID_MAX,
  CUSTOMER_NATIONAL_ID_MIN,
  CUSTOMER_NUMBER_SETTING,
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_STATUS,
  WALK_IN_CUSTOMER_NAME,
  WALK_IN_CUSTOMER_NUMBER,
  WALK_IN_CUSTOMER_PHONE,
  type CustomerSortField,
} from './customers.constants';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { ListCustomersDto } from './dto/list-customers.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersRepository } from './customers.repository';

@Injectable()
export class CustomersService {
  constructor(
    private readonly repo: CustomersRepository,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, actor?: AuthPrincipal): Promise<Customer> {
    const fullName = assertNonEmptyString(dto.fullName, 'fullName');
    if (fullName.length > CUSTOMER_NAME_MAX) {
      throw BusinessException.validation('fullName is too long');
    }
    const primary = normalizePhone(dto.phone);
    await this.assertPrimaryPhoneAvailable(primary.normalized);

    const secondary = optionalNormalizePhone(dto.secondaryPhone);
    const nationalId = this.normalizeNationalId(dto.nationalId);
    const gender = this.normalizeGender(dto.gender);
    const birthDate = this.parseBirthDate(dto.birthDate);
    const status = this.normalizeStatus(dto.status ?? CUSTOMER_STATUS.ACTIVE);
    const customerNumber = await this.allocateCustomerNumber();

    const row = await this.repo.create({
      customerNumber,
      fullName,
      phone: primary.display,
      phoneNormalized: primary.normalized,
      secondaryPhone: secondary?.display ?? null,
      secondaryPhoneNormalized: secondary?.normalized ?? null,
      address: this.emptyToNull(dto.address),
      city: this.emptyToNull(dto.city),
      nationalId,
      gender,
      birthDate,
      notes: this.emptyToNull(dto.notes),
      status,
      createdBy: actor?.userId ?? null,
      updatedBy: actor?.userId ?? null,
    });

    await this.audit.recordCreate(CUSTOMER_MODULE, CUSTOMER_ENTITY, row.id, this.snapshot(row), {
      userId: actor?.userId,
      username: actor?.username,
    });
    return row;
  }

  async update(id: string, dto: UpdateCustomerDto, actor?: AuthPrincipal): Promise<Customer> {
    const existing = await this.requireLive(id);
    const old = this.snapshot(existing);
    const data: Prisma.CustomerUpdateInput = {
      updatedBy: actor?.userId ?? null,
    };

    if (dto.fullName !== undefined) {
      data.fullName = assertNonEmptyString(dto.fullName, 'fullName');
    }
    if (dto.phone !== undefined) {
      const primary = normalizePhone(dto.phone);
      await this.assertPrimaryPhoneAvailable(primary.normalized, id);
      data.phone = primary.display;
      data.phoneNormalized = primary.normalized;
    }
    if (dto.secondaryPhone !== undefined) {
      const secondary = optionalNormalizePhone(dto.secondaryPhone);
      data.secondaryPhone = secondary?.display ?? null;
      data.secondaryPhoneNormalized = secondary?.normalized ?? null;
    }
    if (dto.address !== undefined) data.address = this.emptyToNull(dto.address);
    if (dto.city !== undefined) data.city = this.emptyToNull(dto.city);
    if (dto.nationalId !== undefined) data.nationalId = this.normalizeNationalId(dto.nationalId);
    if (dto.gender !== undefined) data.gender = this.normalizeGender(dto.gender);
    if (dto.clearBirthDate === true) {
      data.birthDate = null;
    } else if (dto.birthDate !== undefined) {
      data.birthDate = dto.birthDate === null ? null : this.parseBirthDate(dto.birthDate);
    }
    if (dto.notes !== undefined) data.notes = this.emptyToNull(dto.notes);
    if (dto.status !== undefined) data.status = this.normalizeStatus(dto.status);

    const updated = await this.repo.update(id, data);
    await this.audit.recordUpdate(
      CUSTOMER_MODULE,
      CUSTOMER_ENTITY,
      id,
      old,
      this.snapshot(updated),
      { userId: actor?.userId, username: actor?.username },
    );
    return updated;
  }

  async softDelete(id: string, actor?: AuthPrincipal): Promise<Customer> {
    const existing = await this.requireLive(id);
    if (existing.customerNumber === WALK_IN_CUSTOMER_NUMBER) {
      throw BusinessException.conflict(
        'Cannot delete the system Walk-in customer',
      );
    }
    const deleted = await this.repo.softDelete(id, actor?.userId);
    await this.audit.recordSoftDelete(
      CUSTOMER_MODULE,
      CUSTOMER_ENTITY,
      id,
      this.snapshot(existing),
      { userId: actor?.userId, username: actor?.username },
    );
    return deleted;
  }

  /** Idempotent system Walk-in customer for anonymous sales (Phase 6.7). */
  async ensureWalkInCustomer(): Promise<Customer> {
    const existing = await this.repo.findAnyByNumber(WALK_IN_CUSTOMER_NUMBER);
    if (existing) {
      if (existing.deletedAt) {
        return this.repo.restore(existing.id, undefined);
      }
      return existing;
    }
    const phone = normalizePhone(WALK_IN_CUSTOMER_PHONE);
    return this.repo.create({
      customerNumber: WALK_IN_CUSTOMER_NUMBER,
      fullName: WALK_IN_CUSTOMER_NAME,
      phone: phone.display,
      phoneNormalized: phone.normalized,
      status: CUSTOMER_STATUS.ACTIVE,
      notes: 'System Walk-in customer for anonymous sales — do not delete',
    });
  }

  isWalkInCustomer(customer: { customerNumber: string }): boolean {
    return customer.customerNumber === WALK_IN_CUSTOMER_NUMBER;
  }

  async restore(id: string, actor?: AuthPrincipal): Promise<Customer> {
    const existing = await this.repo.findById(id, { includeDeleted: true });
    if (!existing) throw BusinessException.notFound('Customer not found');
    if (!existing.deletedAt) {
      throw BusinessException.conflict('Customer is not deleted');
    }
    await this.assertPrimaryPhoneAvailable(existing.phoneNormalized, id);
    const restored = await this.repo.restore(id, actor?.userId);
    await this.audit.record({
      module: CUSTOMER_MODULE,
      entityType: CUSTOMER_ENTITY,
      entityId: id,
      action: AUDIT_ACTION.RESTORE,
      oldValues: this.snapshot(existing),
      newValues: this.snapshot(restored),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return restored;
  }

  async getById(id: string, actor?: AuthPrincipal, opts?: { recordView?: boolean }): Promise<Customer> {
    const row = await this.requireLive(id);
    if (opts?.recordView) {
      await this.audit.record({
        module: CUSTOMER_MODULE,
        entityType: CUSTOMER_ENTITY,
        entityId: id,
        action: AUDIT_ACTION.VIEW,
        actor: { userId: actor?.userId, username: actor?.username },
      });
    }
    return row;
  }

  getByNumber(customerNumber: string): Promise<Customer> {
    return this.requireByNumber(customerNumber);
  }

  async list(query: ListCustomersDto): Promise<Paginated<Customer>> {
    const page = normalizePagination(query as PaginationInput);
    const where = this.buildWhere(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(CUSTOMER_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const orderBy = this.repo.sortFieldToOrder(
      sort.field as CustomerSortField,
      sort.direction,
    );
    const { rows, total } = await this.repo.list({
      where,
      orderBy,
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows, total, page);
  }

  async search(query: ListCustomersDto): Promise<Paginated<Customer>> {
    if (!normalizeSearchQuery(query.q)) {
      throw BusinessException.validation('Search query q is required');
    }
    return this.list(query);
  }

  private buildWhere(query: ListCustomersDto): Prisma.CustomerWhereInput {
    const deleted = parseOptionalBoolean(query.deleted) === true;
    const where: Prisma.CustomerWhereInput = {
      deletedAt: deleted ? { not: null } : null,
    };
    if (query.status) where.status = this.normalizeStatus(query.status);
    if (query.city?.trim()) {
      where.city = { contains: query.city.trim() };
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
        ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
      };
    }
    if (query.updatedFrom || query.updatedTo) {
      where.updatedAt = {
        ...(query.updatedFrom ? { gte: new Date(query.updatedFrom) } : {}),
        ...(query.updatedTo ? { lte: new Date(query.updatedTo) } : {}),
      };
    }

    const q = normalizeSearchQuery(query.q);
    if (q) {
      const phoneQ = q.replace(/[^\d+]/g, '').replace(/^\+/, '');
      where.OR = [
        { fullName: { contains: q } },
        { phone: { contains: q } },
        { phoneNormalized: { contains: phoneQ || q } },
        { secondaryPhone: { contains: q } },
        { secondaryPhoneNormalized: { contains: phoneQ || q } },
        { address: { contains: q } },
        { city: { contains: q } },
        { nationalId: { contains: q } },
        { notes: { contains: q } },
        { customerNumber: { contains: q.toUpperCase() } },
      ];
    }
    return where;
  }

  private async allocateCustomerNumber(): Promise<string> {
    const prefix = (
      await this.settings.getString(CUSTOMER_NUMBER_SETTING.PREFIX, CUSTOMER_DEFAULT_PREFIX)
    ).toUpperCase();
    const separator = await this.settings.getString(
      CUSTOMER_NUMBER_SETTING.SEPARATOR,
      CUSTOMER_DEFAULT_SEPARATOR,
    );
    const padding = await this.settings.getInt(
      CUSTOMER_NUMBER_SETTING.PADDING,
      CUSTOMER_DEFAULT_PADDING,
    );

    for (let i = 0; i < 25; i += 1) {
      const seq = await this.repo.nextSequence(prefix);
      const number = `${prefix}${separator}${String(seq).padStart(padding, '0')}`;
      const clash = await this.repo.findAnyByNumber(number);
      if (!clash) return number;
    }
    throw BusinessException.invariant('Unable to allocate customer number');
  }

  private async assertPrimaryPhoneAvailable(normalized: string, excludeId?: string): Promise<void> {
    const existing = await this.repo.findActiveByPhoneNormalized(normalized, excludeId);
    if (existing) {
      throw BusinessException.conflict('An active customer already uses this primary phone');
    }
  }

  private async requireLive(id: string): Promise<Customer> {
    const row = await this.repo.findById(id);
    if (!row) throw BusinessException.notFound('Customer not found');
    return row;
  }

  private async requireByNumber(customerNumber: string): Promise<Customer> {
    const row = await this.repo.findByNumber(customerNumber);
    if (!row) throw BusinessException.notFound('Customer not found');
    return row;
  }

  private normalizeNationalId(raw: string | null | undefined): string | null {
    if (raw == null) return null;
    const digits = raw.replace(/\s+/g, '').trim();
    if (!digits) return null;
    if (!/^\d+$/.test(digits)) {
      throw BusinessException.validation('nationalId must contain digits only');
    }
    if (digits.length < CUSTOMER_NATIONAL_ID_MIN || digits.length > CUSTOMER_NATIONAL_ID_MAX) {
      throw BusinessException.validation(
        `nationalId length must be ${CUSTOMER_NATIONAL_ID_MIN}-${CUSTOMER_NATIONAL_ID_MAX}`,
      );
    }
    return digits;
  }

  private normalizeGender(raw: string | null | undefined): string | null {
    if (raw == null || raw === '') return null;
    const value = raw.toUpperCase();
    if (!Object.values(CUSTOMER_GENDER).includes(value as never)) {
      throw BusinessException.validation('Invalid gender');
    }
    return value;
  }

  private normalizeStatus(raw: string): string {
    const value = raw.toLowerCase();
    if (!Object.values(CUSTOMER_STATUS).includes(value as never)) {
      throw BusinessException.validation('Invalid status');
    }
    return value;
  }

  private parseBirthDate(raw: string | null | undefined): Date | null {
    if (raw == null || raw === '') return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw BusinessException.validation('Invalid birthDate');
    }
    const today = new Date();
    if (d.getTime() > today.getTime()) {
      throw BusinessException.validation('birthDate cannot be in the future');
    }
    return d;
  }

  private emptyToNull(value: string | null | undefined): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private snapshot(row: Customer): Record<string, unknown> {
    return {
      id: row.id,
      customerNumber: row.customerNumber,
      fullName: row.fullName,
      phone: row.phone,
      phoneNormalized: row.phoneNormalized,
      secondaryPhone: row.secondaryPhone,
      city: row.city,
      status: row.status,
      deletedAt: row.deletedAt,
    };
  }
}