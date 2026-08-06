export const REPORT_CHART_COLORS = [
  'var(--brand)',
  'var(--success)',
  'var(--warning)',
  'var(--destructive)',
  'var(--foreground-secondary)',
  'var(--muted-foreground)'
] as const

export const REPORT_CHART_GRID = 'var(--border-subtle)'
export const REPORT_CHART_AXIS = 'var(--muted-foreground)'
export const REPORT_CHART_TOOLTIP_BG = 'var(--card)'
export const REPORT_CHART_TOOLTIP_BORDER = 'var(--border)'

export function reportChartColor(index: number): string {
  return REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]!
}
