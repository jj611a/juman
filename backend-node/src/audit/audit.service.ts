import { Injectable } from '@nestjs/common';
import type { AuditLog } from '@prisma/client';
import { AUDIT_ACTION } from '../shared/constants/business.constants';
import { normalizePagination, paginated, type Paginated, type PaginationInput } from '../shared/pagination/pagination';
import { assertNonEmptyString } from '../shared/validation/assert';
import { AuditRepository } from './audit.repository';
import type { AuditRecordInput } from './audit.types';

/**
 * Centralized domain audit writer.
 * Future modules must call AuditService.record(...) — never write AuditLog directly.
 */
@Injectable()
export class AuditService {
  constructor(private readonly repo: AuditRepository) {}

  async record(input: AuditRecordInput): Promise<AuditLog> {
    const module = assertNonEmptyString(input.module, 'module').toLowerCase();
    const entityType = assertNonEmptyString(input.entityType, 'entityType').toLowerCase();
    const action = assertNonEmptyString(String(input.action), 'action').toLowerCase();
    return this.repo.create({
      module,
      entityType,
      entityId: input.entityId ?? null,
      action,
      oldValues: this.json(input.oldValues),
      newValues: this.json(input.newValues),
      userId: input.actor?.userId ?? null,
      username: input.actor?.username?.trim().toLowerCase() ?? null,
      ipAddress: input.actor?.ipAddress ?? null,
      metadata: this.json(input.metadata),
      message: input.message ?? null,
    });
  }

  recordCreate(
    module: string,
    entityType: string,
    entityId: string,
    newValues: unknown,
    actor?: AuditRecordInput['actor'],
  ): Promise<AuditLog> {
    return this.record({
      module,
      entityType,
      entityId,
      action: AUDIT_ACTION.CREATE,
      newValues,
      actor,
    });
  }

  recordUpdate(
    module: string,
    entityType: string,
    entityId: string,
    oldValues: unknown,
    newValues: unknown,
    actor?: AuditRecordInput['actor'],
  ): Promise<AuditLog> {
    return this.record({
      module,
      entityType,
      entityId,
      action: AUDIT_ACTION.UPDATE,
      oldValues,
      newValues,
      actor,
    });
  }

  recordSoftDelete(
    module: string,
    entityType: string,
    entityId: string,
    oldValues?: unknown,
    actor?: AuditRecordInput['actor'],
  ): Promise<AuditLog> {
    return this.record({
      module,
      entityType,
      entityId,
      action: AUDIT_ACTION.SOFT_DELETE,
      oldValues,
      actor,
    });
  }

  async list(
    filters: {
      module?: string;
      entityType?: string;
      entityId?: string;
      action?: string;
    } & PaginationInput,
  ): Promise<Paginated<AuditLog>> {
    const page = normalizePagination(filters);
    const { rows, total } = await this.repo.list({ ...filters, ...page });
    return paginated(rows, total, page);
  }

  private json(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    return JSON.stringify(value);
  }
}