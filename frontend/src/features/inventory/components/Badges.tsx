import type { ItemDto } from '../api/api'
import {
  STATUS_BADGE,
  CONDITION_BADGE,
  LIFECYCLE_BADGE,
  STATUS_LABELS,
  CONDITION_LABELS,
  LIFECYCLE_LABELS,
} from '../constants/inventory'

export function StatusBadge({ value }: { value: string }) {
  const cls = STATUS_BADGE[value as keyof typeof STATUS_BADGE] ?? 'badge-ghost'
  return (
    <span className={`badge badge-xs font-bold ${cls}`}>
      {STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? value}
    </span>
  )
}

export function ConditionBadge({ value }: { value: string }) {
  const cls = CONDITION_BADGE[value as keyof typeof CONDITION_BADGE] ?? 'badge-ghost'
  return (
    <span className={`badge badge-xs font-bold ${cls}`}>
      {CONDITION_LABELS[value as keyof typeof CONDITION_LABELS] ?? value}
    </span>
  )
}

export function LifecycleBadge({ value }: { value: string }) {
  const cls = LIFECYCLE_BADGE[value as keyof typeof LIFECYCLE_BADGE] ?? 'badge-neutral'
  return (
    <span className={`badge badge-xs font-bold ${cls}`}>
      {LIFECYCLE_LABELS[value as keyof typeof LIFECYCLE_LABELS] ?? value}
    </span>
  )
}

export function ItemThumbnail({
  item,
  className = 'h-12 w-12 rounded-lg',
}: {
  item: Pick<ItemDto, 'media' | 'displayName'>
  className?: string
}) {
  const primary = item.media?.find((m) => m.isPrimary) ?? item.media?.[0]

  return (
    <div
      title={primary ? `${primary.mediaFile.originalFilename} (${primary.mediaFile.mimeType})` : 'لا توجد صور'}
      className={`${className} flex items-center justify-center bg-base-200 text-base-content/30`}
    >
      <span aria-hidden="true" className="text-xl">✦</span>
    </div>
  )
}
