/** Future-ready saved report filter preset (not persisted in v1). */
export interface SavedReportFilter {
  id: string
  reportId: string
  label: string
  dateFrom?: string
  dateTo?: string
  params?: Record<string, string | number | boolean>
}

const STORAGE_KEY = 'juman.reportFilters.v1'

/** Local helper stub — returns empty list until persistence is implemented. */
export function loadSavedReportFilters(_reportId?: string): SavedReportFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedReportFilter[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Hook stub for future saved-filter UI. */
export function useSavedReportFilters(reportId: string) {
  return {
    reportId,
    filters: loadSavedReportFilters(reportId),
    save: (_filter: Omit<SavedReportFilter, 'id'>): void => {
      /* v1 noop */
    },
    remove: (_id: string): void => {
      /* v1 noop */
    }
  }
}
