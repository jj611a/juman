import { EmptyState } from '@/shared/components/feedback/EmptyState'

export function PermissionDenied({ feature }: { feature?: string }) {
  return (
    <EmptyState
      title="لا تملك صلاحية العرض"
      description={
        feature
          ? `الوحدة «${feature}» تتطلب صلاحية غير متاحة لحسابك.`
          : 'اطلب من المسؤول إضافة الصلاحية المناسبة.'
      }
    />
  )
}
