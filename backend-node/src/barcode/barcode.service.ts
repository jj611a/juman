import { Injectable, HttpStatus } from '@nestjs/common';
import type { Barcode, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import {
  AUDIT_ACTION,
  BARCODE_DEFAULT_PADDING,
  BARCODE_DEFAULT_PREFIX,
  BARCODE_DEFAULT_SEPARATOR,
  BARCODE_PREFIX_PATTERN,
  BARCODE_STATUS,
} from '../shared/constants/business.constants';
import { DOMAIN_ERROR_CODE } from '../shared/errors/domain.errors';
import { BusinessException } from '../shared/errors/business.exception';
import { operatorMessage } from '../shared/localization/messages';
import {
  normalizePagination,
  paginated,
  type Paginated,
} from '../shared/pagination/pagination';
import { normalizeSearchQuery } from '../shared/search/search';
import { normalizeSort } from '../shared/sorting/sorting';
import { assertInRange, assertMatch, assertNonEmptyString } from '../shared/validation/assert';
import type { AuthPrincipal } from '../shared/types';
import {
  BARCODE_ENTITY,
  BARCODE_MODULE,
  BARCODE_SETTING,
  BARCODE_SORT_FIELDS,
  BARCODE_TYPE,
  type BarcodeType,
} from './barcode.constants';
import { toPublicBarcode, type BarcodePublic } from './barcode.mapper';
import { normalizeBarcodeValue } from './barcode.normalize';
import { BarcodeRepository } from './barcode.repository';
import { assertValidSymbology, isBarcodeType } from './barcode.symbology';
import type {
  BarcodeFormatOptions,
  GenerateBarcodeInput,
  ListBarcodesInput,
  ReserveBarcodeInput,
} from './barcode.types';

/**
 * Reusable barcode platform.
 * Domains bind codes via activate(entityType, entityId) ? no inventory workflows here.
 */
@Injectable()
export class BarcodeService {
  constructor(
    private readonly repo: BarcodeRepository,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  normalize(raw: string, type: BarcodeType = BARCODE_TYPE.CODE128): string {
    return normalizeBarcodeValue(raw, type);
  }

  async resolveDefaultType(): Promise<BarcodeType> {
    const raw = (
      await this.settings.getString(BARCODE_SETTING.DEFAULT_TYPE, BARCODE_TYPE.CODE128)
    ).toLowerCase();
    if (!isBarcodeType(raw)) {
      throw BusinessException.validation('Invalid barcode.default_type setting');
    }
    return raw;
  }

  async resolveFormat(overrides?: BarcodeFormatOptions): Promise<{
    prefix: string;
    separator: string;
    padding: number;
  }> {
    const prefix = (
      overrides?.prefix ??
      (await this.settings.getString(BARCODE_SETTING.PREFIX, BARCODE_DEFAULT_PREFIX))
    ).toUpperCase();
    const separator =
      overrides?.separator ??
      (await this.settings.getString(BARCODE_SETTING.SEPARATOR, BARCODE_DEFAULT_SEPARATOR));
    const padding =
      overrides?.padding ??
      (await this.settings.getInt(BARCODE_SETTING.PADDING, BARCODE_DEFAULT_PADDING));
    assertMatch(prefix, BARCODE_PREFIX_PATTERN, 'Barcode prefix must be A-Z / 0-9');
    assertInRange(padding, 1, 16, 'barcode.padding');
    if (separator !== '' && separator !== '-' && separator !== '_') {
      throw BusinessException.validation('Barcode separator must be empty, "-" or "_"');
    }
    return { prefix, separator, padding };
  }

  formatCode(sequence: number, options: { prefix: string; separator: string; padding: number }): string {
    if (!Number.isInteger(sequence) || sequence < 1) {
      throw new BusinessException(DOMAIN_ERROR_CODE.BARCODE_INVALID, operatorMessage('barcode.invalid'));
    }
    const body = String(sequence).padStart(options.padding, '0');
    return `${options.prefix}${options.separator}${body}`;
  }

  validateFormat(code: string, options?: { prefix: string; separator: string; padding: number }): boolean {
    const trimmed = assertNonEmptyString(code, 'code');
    if (!options) {
      return /^[A-Z0-9]+[-_]?[0-9]+$/i.test(trimmed);
    }
    const escapedSep = options.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `^${options.prefix}${escapedSep}\\d{${options.padding}}$`,
      'i',
    );
    return re.test(trimmed);
  }

  async exists(value: string, type?: BarcodeType): Promise<boolean> {
    const resolvedType = type ?? (await this.resolveDefaultType());
    const code = this.normalize(value, resolvedType);
    return (await this.repo.findAnyByCode(code)) != null;
  }

  async assertAvailable(code: string): Promise<void> {
    const existing = await this.repo.findAnyByCode(code);
    if (existing) {
      throw new BusinessException(DOMAIN_ERROR_CODE.BARCODE_TAKEN, operatorMessage('barcode.taken'), {
        status: HttpStatus.CONFLICT,
      });
    }
  }

  async isAvailable(code: string): Promise<boolean> {
    return !(await this.exists(code));
  }

  /**
   * Validate value for a symbology. Audits validation failures.
   */
  async validate(
    valueRaw: string,
    typeRaw?: string,
    actor?: AuthPrincipal,
  ): Promise<{ ok: true; value: string; type: BarcodeType } | { ok: false; reason: string }> {
    try {
      const type = await this.resolveType(typeRaw);
      const value = this.normalize(valueRaw, type);
      assertValidSymbology(value, type);
      if (type === BARCODE_TYPE.CODE128 || type === BARCODE_TYPE.CODE39) {
        // Generated inventory-style codes additionally match prefix format when applicable
        if (!this.validateFormat(value) && !/^\d+$/.test(value)) {
          // allow pure symbology payloads that are not DR-########
        }
      }
      return { ok: true, value, type };
    } catch (err) {
      const reason = err instanceof BusinessException ? err.message : 'Invalid barcode';
      await this.audit.record({
        module: BARCODE_MODULE,
        entityType: BARCODE_ENTITY,
        action: AUDIT_ACTION.VALIDATE_FAILURE,
        message: reason,
        newValues: { value: valueRaw, type: typeRaw },
        actor: { userId: actor?.userId, username: actor?.username },
      });
      return { ok: false, reason };
    }
  }

  /** Generate + persist a new reserved barcode (globally unique). */
  async generate(input: GenerateBarcodeInput = {}, actor?: AuthPrincipal): Promise<Barcode> {
    const type = await this.resolveType(input.type);
    if (type === BARCODE_TYPE.EAN13 || type === BARCODE_TYPE.EAN8 || type === BARCODE_TYPE.UPC_A) {
      throw BusinessException.validation(
        'EAN/UPC generation requires an explicit value via reserve(); sequential generator is Code-128/39/QR',
      );
    }
    const createdBy = input.createdBy ?? actor?.userId ?? null;
    const row = await this.reserveNext(createdBy ?? undefined, input.overrides, type);
    await this.audit.record({
      module: BARCODE_MODULE,
      entityType: BARCODE_ENTITY,
      entityId: row.id,
      action: AUDIT_ACTION.GENERATE,
      newValues: { value: row.code, type: row.type, status: row.status },
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return row;
  }

  async reserve(input: ReserveBarcodeInput = {}, actor?: AuthPrincipal): Promise<Barcode> {
    const createdBy = input.createdBy ?? actor?.userId ?? undefined;
    if (input.value?.trim()) {
      return this.reserveCode(input.value, createdBy, input.type);
    }
    return this.reserveNext(createdBy, input.overrides, input.type);
  }

  async reserveNext(
    createdBy?: string,
    overrides?: BarcodeFormatOptions,
    typeRaw?: string | BarcodeType,
  ): Promise<Barcode> {
    const type = await this.resolveType(typeRaw);
    const format = await this.resolveFormat(overrides);
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const seq = await this.repo.nextSequence(format.prefix);
      const code = this.normalize(this.formatCode(seq, format), type);
      assertValidSymbology(code, type);
      if (!(await this.isAvailable(code))) continue;
      const row = await this.repo.create({
        code,
        type,
        prefix: format.prefix,
        status: BARCODE_STATUS.RESERVED,
        entityType: null,
        entityId: null,
        reservedAt: new Date(),
        activatedAt: null,
        retiredAt: null,
        createdBy: createdBy ?? null,
      });
      await this.audit.record({
        module: BARCODE_MODULE,
        entityType: BARCODE_ENTITY,
        entityId: row.id,
        action: AUDIT_ACTION.RESERVE,
        newValues: { value: row.code, status: row.status, type: row.type },
        actor: { userId: createdBy },
      });
      return row;
    }
    throw BusinessException.invariant('Unable to reserve a unique barcode');
  }

  async reserveCode(
    codeRaw: string,
    createdBy?: string,
    typeRaw?: string | BarcodeType,
  ): Promise<Barcode> {
    const type = await this.resolveType(typeRaw);
    const code = this.normalize(codeRaw, type);
    assertValidSymbology(code, type);
    await this.assertAvailable(code);
    const format = await this.resolveFormat();
    const prefix =
      code.startsWith(format.prefix)
        ? format.prefix
        : code.replace(/[^A-Z0-9].*$/i, '').toUpperCase() || format.prefix;
    const digits = code.match(/(\d+)$/)?.[1];
    if (digits) {
      await this.repo.bumpSequenceAtLeast(prefix, Number(digits));
    }
    const row = await this.repo.create({
      code,
      type,
      prefix,
      status: BARCODE_STATUS.RESERVED,
      entityType: null,
      entityId: null,
      reservedAt: new Date(),
      activatedAt: null,
      retiredAt: null,
      createdBy: createdBy ?? null,
    });
    await this.audit.record({
      module: BARCODE_MODULE,
      entityType: BARCODE_ENTITY,
      entityId: row.id,
      action: AUDIT_ACTION.RESERVE,
      newValues: { value: row.code, type: row.type },
      actor: { userId: createdBy },
    });
    return row;
  }

  /** Bind barcode to an opaque entity (future inventory/customers/orders). */
  async activate(
    valueOrId: string,
    entityType: string,
    entityId: string,
    actor?: AuthPrincipal,
  ): Promise<Barcode> {
    const row = await this.requireLiveByValueOrId(valueOrId);
    if (row.status === BARCODE_STATUS.RETIRED) {
      throw BusinessException.conflict('Cannot activate a retired barcode');
    }
    if (row.status === BARCODE_STATUS.ACTIVATED && row.entityId && row.entityId !== entityId) {
      throw BusinessException.conflict('Barcode already activated on another entity');
    }
    const updated = await this.repo.update(row.id, {
      status: BARCODE_STATUS.ACTIVATED,
      entityType: assertNonEmptyString(entityType, 'entityType').toLowerCase(),
      entityId: assertNonEmptyString(entityId, 'entityId'),
      activatedAt: new Date(),
      updatedBy: actor?.userId ?? null,
    });
    await this.audit.record({
      module: BARCODE_MODULE,
      entityType: BARCODE_ENTITY,
      entityId: updated.id,
      action: AUDIT_ACTION.ALLOCATE,
      oldValues: { status: row.status },
      newValues: { status: updated.status, entityType, entityId },
      message: 'assigned',
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return updated;
  }

  /** @deprecated Prefer activate() */
  allocate(
    code: string,
    entityType: string,
    entityId: string,
    updatedBy?: string,
  ): Promise<Barcode> {
    return this.activate(code, entityType, entityId, updatedBy ? { userId: updatedBy } as AuthPrincipal : undefined);
  }

  /**
   * Release binding: activated ? reserved (value remains unique, not recycled as a new generate).
   */
  async release(valueOrId: string, actor?: AuthPrincipal): Promise<Barcode> {
    const row = await this.requireLiveByValueOrId(valueOrId);
    if (row.status === BARCODE_STATUS.RETIRED) {
      throw BusinessException.conflict('Cannot release a retired barcode');
    }
    if (row.status !== BARCODE_STATUS.ACTIVATED) {
      throw BusinessException.conflict('Only activated barcodes can be released');
    }
    const updated = await this.repo.update(row.id, {
      status: BARCODE_STATUS.RESERVED,
      entityType: null,
      entityId: null,
      activatedAt: null,
      updatedBy: actor?.userId ?? null,
    });
    await this.audit.record({
      module: BARCODE_MODULE,
      entityType: BARCODE_ENTITY,
      entityId: updated.id,
      action: AUDIT_ACTION.RELEASE,
      oldValues: { status: row.status, entityType: row.entityType, entityId: row.entityId },
      newValues: { status: updated.status },
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return updated;
  }

  /** Terminal retirement ? value remains historically unique forever. */
  async retire(valueOrId: string, actor?: AuthPrincipal): Promise<Barcode> {
    const row = await this.requireLiveByValueOrId(valueOrId);
    if (row.status === BARCODE_STATUS.RETIRED) {
      throw BusinessException.conflict('Barcode is already retired');
    }
    const updated = await this.repo.update(row.id, {
      status: BARCODE_STATUS.RETIRED,
      retiredAt: new Date(),
      updatedBy: actor?.userId ?? null,
    });
    await this.audit.record({
      module: BARCODE_MODULE,
      entityType: BARCODE_ENTITY,
      entityId: updated.id,
      action: AUDIT_ACTION.RETIRE,
      oldValues: { status: row.status },
      newValues: { status: updated.status },
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return updated;
  }

  async find(id: string): Promise<Barcode> {
    const row = await this.repo.findById(id);
    if (!row) throw BusinessException.notFound('Barcode not found');
    return row;
  }

  async findPublic(id: string): Promise<BarcodePublic> {
    return toPublicBarcode(await this.find(id));
  }

  async findByValue(value: string, type?: BarcodeType): Promise<Barcode> {
    const resolved = type ?? (await this.resolveDefaultType());
    const code = this.normalize(value, resolved);
    const row = await this.repo.findByCode(code);
    if (!row) throw BusinessException.notFound('Barcode not found');
    return row;
  }

  async findMany(query: ListBarcodesInput): Promise<Paginated<BarcodePublic>> {
    const page = normalizePagination(query);
    const where = this.buildWhere(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(BARCODE_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const orderBy = { [sort.field]: sort.direction } as Prisma.BarcodeOrderByWithRelationInput;
    const { rows, total } = await this.repo.list({
      where,
      orderBy,
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows.map(toPublicBarcode), total, page);
  }

  private buildWhere(query: ListBarcodesInput): Prisma.BarcodeWhereInput {
    const where: Prisma.BarcodeWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status.toLowerCase();
    if (query.type) where.type = query.type.toLowerCase();
    if (query.entityType) where.entityType = query.entityType.toLowerCase();
    if (query.entityId) where.entityId = query.entityId;
    if (query.prefix?.trim()) where.prefix = query.prefix.trim().toUpperCase();
    const q = normalizeSearchQuery(query.q);
    if (q) {
      where.OR = [
        { code: { equals: q.toUpperCase() } },
        { code: { startsWith: q.toUpperCase() } },
        { code: { contains: q } },
        { prefix: { contains: q.toUpperCase() } },
      ];
    }
    return where;
  }

  private async requireLiveByValueOrId(valueOrId: string): Promise<Barcode> {
    const raw = assertNonEmptyString(valueOrId, 'value');
    const byId = await this.repo.findById(raw);
    if (byId) return byId;
    const type = await this.resolveDefaultType();
    const code = this.normalize(raw, type);
    const byCode = await this.repo.findByCode(code);
    if (!byCode) throw BusinessException.notFound('Barcode not found');
    return byCode;
  }

  private async resolveType(typeRaw?: string | BarcodeType): Promise<BarcodeType> {
    if (typeRaw == null || typeRaw === '') return this.resolveDefaultType();
    const type = String(typeRaw).toLowerCase();
    if (!isBarcodeType(type)) {
      throw BusinessException.validation(`Unsupported barcode type: ${type}`);
    }
    return type;
  }
}
