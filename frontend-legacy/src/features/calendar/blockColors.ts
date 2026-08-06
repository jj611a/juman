/** Map backend block_type → CSS classes (backend has no colors). */
export const BLOCK_TYPE_LABELS: Record<string, string> = {
  RESERVATION: 'حجز',
  RENTAL: 'تأجير',
  PROCESSING: 'معالجة',
  MAINTENANCE: 'صيانة'
}

export const BLOCK_TYPE_CLASS: Record<string, string> = {
  RESERVATION: 'border-[var(--color-info)] bg-[color-mix(in_srgb,var(--color-info)_18%,transparent)]',
  RENTAL: 'border-[var(--color-warning)] bg-[color-mix(in_srgb,var(--color-warning)_18%,transparent)]',
  PROCESSING: 'border-[var(--color-brand)] bg-[var(--color-brand-subtle)]',
  MAINTENANCE:
    'border-[var(--color-destructive)] bg-[color-mix(in_srgb,var(--color-destructive)_18%,transparent)]'
}

export function blockClass(type: string): string {
  return BLOCK_TYPE_CLASS[type] ?? 'border-border bg-secondary'
}
