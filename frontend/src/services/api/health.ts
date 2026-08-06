import { apiInvoke } from '@/ipc/api'

export interface HealthDto {
  status: string
  database?: string
  version?: string
  uptime?: number
  environment?: string
}

/** Public Nest health — no auth. */
export function fetchHealth(): Promise<HealthDto> {
  return apiInvoke({ method: 'GET', path: '/health' })
}
