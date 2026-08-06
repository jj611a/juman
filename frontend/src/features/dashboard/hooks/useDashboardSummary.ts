import { useQuery } from '@tanstack/react-query'
import { fetchDashboardSummary } from '@/services/api/reports'

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: fetchDashboardSummary,
    refetchInterval: 60_000,
    retry: 1
  })
}
