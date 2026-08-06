import { useQuery } from '@tanstack/react-query'
import { fetchHealth, type HealthDto } from '@/services/api/health'

export function useBackendHealth() {
  return useQuery<HealthDto>({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 1,
  })
}
