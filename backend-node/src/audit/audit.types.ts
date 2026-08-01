import type { AuditAction } from '../shared/constants/business.constants';

export interface AuditActor {
  readonly userId?: string | null;
  readonly username?: string | null;
  readonly ipAddress?: string | null;
}

export interface AuditRecordInput {
  readonly module: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly action: AuditAction | string;
  readonly oldValues?: unknown;
  readonly newValues?: unknown;
  readonly metadata?: unknown;
  readonly message?: string | null;
  readonly actor?: AuditActor;
}