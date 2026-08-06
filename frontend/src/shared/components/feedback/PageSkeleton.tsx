export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="جاري التحميل">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-4 w-96 max-w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="skeleton h-28 w-full" />
        <div className="skeleton h-28 w-full" />
        <div className="skeleton h-28 w-full" />
      </div>
      <div className="skeleton h-64 w-full" />
    </div>
  )
}
