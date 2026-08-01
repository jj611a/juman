/** Shape every soft-deletable business entity should expose. */
export interface TimestampFields {
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SoftDeleteFields {
  readonly deletedAt: Date | null;
}

export interface AuditActorFields {
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
}

export interface UuidEntity {
  readonly id: string;
}

/** CommonEntity = UUID + timestamps + soft-delete + optional actors. */
export type CommonEntity = UuidEntity & TimestampFields & SoftDeleteFields & AuditActorFields;

export interface AuditBaseFields {
  readonly module: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly action: string;
  readonly userId: string | null;
  readonly username: string | null;
  readonly createdAt: Date;
}