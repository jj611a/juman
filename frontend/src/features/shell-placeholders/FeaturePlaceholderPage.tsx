import { EmptyState } from '@/shared/components/feedback/EmptyState'

/** Placeholder until the owning Phase 9.x ships. */
export function FeaturePlaceholderPage({
  title,
  phase,
  description,
}: {
  title: string
  phase: string
  description?: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="breadcrumbs text-sm">
          <ul>
            <li>المراحل</li>
            <li>{phase}</li>
          </ul>
        </div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-base-content/60">
          {description ??
            'هذه الشاشة مخططة ضمن إعادة بناء الواجهة. لا منطق أعمال حتى اعتماد المرحلة.'}
        </p>
      </div>
      <EmptyState
        title={`قريباً — المرحلة ${phase}`}
        description="الخلفية Nest جاهزة ومجمدة. الواجهة ستستهلك عقودها الحالية فقط دون تغييرها."
      />
    </div>
  )
}
