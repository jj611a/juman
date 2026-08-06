import type { ApiInvokeRequest } from './apiInvoke'
import type { AppRuntimeConfig } from './api'
import type { SessionView } from './session'

export interface JumanPreloadApi {
  auth: {
    getSession: () => Promise<SessionView>
    login: (payload: {
      username: string
      password: string
      remember?: boolean
    }) => Promise<SessionView>
    logout: () => Promise<SessionView>
    changePassword: (payload: {
      currentPassword: string
      newPassword: string
    }) => Promise<void>
    onChanged: (listener: (session: SessionView) => void) => () => void
  }
  api: {
    invoke: <T = unknown>(request: ApiInvokeRequest) => Promise<T>
  }
  app: {
    getConfig: () => Promise<AppRuntimeConfig>
  }
  window?: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }
}
