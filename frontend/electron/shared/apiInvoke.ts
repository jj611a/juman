export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiInvokeRequest {
  method: HttpMethod
  path: string
  query?: Record<string, unknown>
  body?: unknown
}
