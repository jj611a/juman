import { Injectable } from '@nestjs/common';
import type { Barcode } from '@prisma/client';
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
import { assertInRange, assertMatch, assertNonEmptyString } from '../shared/validation/assert';
import { AuditService } from '../audit/audit.service';
import { BarcodeRepository } from './barcode.repository';

export interface BarcodeFormatOptions {
  readonly prefix?: string;
  readonly separator?: string;
  readonly padding?: number;
}

/**
 * Barcode abstraction: format, validate, uniqueness, reservation, generation.
 * Does not implement inventory assignment flows.
 */
@Injectable()
export class BarcodeService {
  constructor(
    private readonly repo: BarcodeRepository,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async resolveFormat(overrides?: BarcodeFormatOptions): Promise<{
    prefix: string;
    separator: string;
    padding: number;
  }> {
    const prefix = (
      overrides?.prefix ??
      (await this.settings.getString('barcode.prefix', BARCODE_DEFAULT_PREFIX))
    ).toUpperCase();
    const separator =
      overrides?.separator ??
      (await this.settings.getString('barcode.separator', BARCODE_DEFAULT_SEPARATOR));
    const padding =
      overrides?.padding ??
      (await this.settings.getInt('barcode.padding', BARCODE_DEFAULT_PADDING));
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

  async assertAvailable(code: string): Promise<void> {
    const existing = await this.repo.findAnyByCode(code);
    if (existing) {
      throw new BusinessException(DOMAIN_ERROR_CODE.BARCODE_TAKEN, operatorMessage('barcode.taken'));
    }
  }

  async isAvailable(code: string): Promise<boolean> {
    const existing = await this.repo.findAnyByCode(code);
    return existing == null;
  }

  /**
   * Reserve a generated barcode code without binding to an entity yet.
   */
  async reserveNext(createdBy?: string, overrides?: BarcodeFormatOptions): Promise<Barcode> {
    const format = await this.resolveFormat(overrides);
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const seq = await this.repo.nextSequence(format.prefix);
      const code = this.formatCode(seq, format);
      if (!(await this.isAvailable(code))) continue;
      const row = await this.repo.create({
        code,
        prefix: format.prefix,
        status: BARCODE_STATUS.RESERVED,
        entityType: null,
        entityId: null,
        reservedAt: new Date(),
        allocatedAt: null,
        createdBy: createdBy ?? null,
      });
      await this.audit.record({
        module: 'barcode',
        entityType: 'barcode',
        entityId: row.id,
        action: AUDIT_ACTION.RESERVE,
        newValues: { code: row.code, status: row.status },
        actor: { userId: createdBy },
      });
      return row;
    }
    throw BusinessException.invariant('Unable to reserve a unique barcode');
  }

  /**
   * Reserve an explicit code (manual entry). Bumps sequence if numeric suffix is higher.
   */
  async reserveCode(codeRaw: string, createdBy?: string): Promise<Barcode> {
    const code = assertNonEmptyString(codeRaw, 'code').toUpperCase();
    if (!this.validateFormat(code)) {
      throw new BusinessException(DOMAIN_ERROR_CODE.BARCODE_INVALID, operatorMessage('barcode.invalid'));
    }
    await this.assertAvailable(code);
    const format = await this.resolveFormat();
    const prefix = code.startsWith(format.prefix) ? format.prefix : code.replace(/[^A-Z0-9].*$/i, '').toUpperCase() || format.prefix;
    const digits = code.match(/(\d+)$/)?.[1];
    if (digits) {
      await this.repo.bumpSequenceAtLeast(prefix, Number(digits));
    }
    const row = await this.repo.create({
      code,
      prefix,
      status: BARCODE_STATUS.RESERVED,
      entityType: null,
      entityId: null,
      reservedAt: new Date(),
      allocatedAt: null,
      createdBy: createdBy ?? null,
    });
    await this.audit.record({
      module: 'barcode',
      entityType: 'barcode',
      entityId: row.id,
      action: AUDIT_ACTION.RESERVE,
      newValues: { code: row.code },
      actor: { userId: createdBy },
    });
    return row;
  }

  async allocate(
    code: string,
    entityType: string,
    entityId: string,
    updatedBy?: string,
  ): Promise<Barcode> {
    const row = await this.repo.findByCode(code);
    if (!row) throw BusinessException.notFound('Barcode not found');
    if (row.status === BARCODE_STATUS.RELEASED) {
      throw BusinessException.conflict('Cannot allocate a released barcode');
    }
    const updated = await this.repo.updateStatus(row.id, {
      status: BARCODE_STATUS.ALLOCATED,
      entityType: entityType.toLowerCase(),
      entityId,
      allocatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    });
    await this.audit.record({
      module: 'barcode',
      entityType: 'barcode',
      entityId: updated.id,
      action: AUDIT_ACTION.ALLOCATE,
      oldValues: { status: row.status },
      newValues: { status: updated.status, entityType, entityId },
      actor: { userId: updatedBy },
    });
    return updated;
  }

  async release(code: string, updatedBy?: string): Promise<Barcode> {
    const row = await this.repo.findByCode(code);
    if (!row) throw BusinessException.notFound('Barcode not found');
    const updated = await this.repo.updateStatus(row.id, {
      status: BARCODE_STATUS.RELEASED,
      releasedAt: new Date(),
      updatedBy: updatedBy ?? null,
    });
    await this.audit.record({
      module: 'barcode',
      entityType: 'barcode',
      entityId: updated.id,
      action: AUDIT_ACTION.RELEASE,
      oldValues: { status: row.status },
      newValues: { status: updated.status },
      actor: { userId: updatedBy },
    });
    return updated;
  }
}