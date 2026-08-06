import type { ApiInvokeRequest } from '@shared/apiInvoke'

/** Typed Nest invoke — Main attaches Authorization; renderer never sees JWT. */
export function apiInvoke<T = unknown>(request: ApiInvokeRequest): Promise<T> {
  return window.juman.api.invoke(request)
}
