import type { ReactNode } from 'react'

interface DashboardCardProps {
  title: string
  value: ReactNode
  desc?: ReactNode
  icon?: ReactNode
  trend?: {
    value: string
    positive?: boolean
  }
  loading?: boolean
  error?: string | null
}

export function DashboardCard({
  title,
  value,
  desc,
  icon,
  trend,
  loading = false,
  error = null
}: DashboardCardProps) {
  if (loading) {
    return (
      <div className="stat rounded-box border border-base-content/10 bg-base-300/80 p-6 select-none relative overflow-hidden">
        <div className="animate-pulse flex flex-col gap-3">
          <div className="h-4 w-24 bg-base-content/10 rounded"></div>
          <div className="h-8 w-16 bg-base-content/15 rounded"></div>
          <div className="h-3 w-32 bg-base-content/10 rounded"></div>
        </div>
        {/* Shimmer overlay */}
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-base-content/5 to-transparent animate-shimmer"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="stat rounded-box border border-error/25 bg-error/5 p-6 select-none flex flex-col justify-between">
        <div className="stat-title text-error/70 font-semibold">{title}</div>
        <div className="text-xs text-error/80 mt-2 font-medium">{error}</div>
      </div>
    )
  }

  return (
    <div className="stat rounded-box border border-base-content/10 bg-base-300/80 p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:border-primary/20 hover:bg-base-300/90 group select-none relative overflow-hidden">
      <div className="flex justify-between items-start">
        <div>
          <div className="stat-title text-base-content/60 text-xs font-semibold group-hover:text-base-content/80 transition-colors">
            {title}
          </div>
          <div className="stat-value text-2xl font-black text-base-content mt-1.5 leading-none">
            {value}
          </div>
        </div>
        {icon && (
          <div className="text-primary/70 bg-primary/10 p-2 rounded-lg group-hover:bg-primary/25 group-hover:text-primary transition-all duration-300 shrink-0">
            {icon}
          </div>
        )}
      </div>
      {(desc || trend) && (
        <div className="stat-desc mt-3.5 flex items-center gap-1.5 text-[11px] text-base-content/40 font-medium">
          {trend && (
            <span className={`font-extrabold ${trend.positive ? 'text-success' : 'text-error'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {desc && <span className="truncate">{desc}</span>}
        </div>
      )}
    </div>
  )
}
