/** Nest V2 soft-delete: nullable deletedAt (live rows have deletedAt = null). */
export function liveWhere<T extends Record<string, unknown>>(
  extra?: T,
): T & { deletedAt: null } {
  return { ...(extra ?? ({} as T)), deletedAt: null };
}

export function isSoftDeleted(entity: { deletedAt: Date | null | undefined }): boolean {
  return entity.deletedAt != null;
}

export function softDeleteData(now = new Date()): { deletedAt: Date } {
  return { deletedAt: now };
}

export function restoreSoftDeleteData(): { deletedAt: null } {
  return { deletedAt: null };
}