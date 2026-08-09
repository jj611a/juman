import type { ApiInvokeRequest } from './apiInvoke'
import type { AppRuntimeConfig } from './api'
import type { SessionView } from './session'
import type { StartupStatus } from './startup'

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
  media: {
    upload: (file: {
      name: string
      mimeType: string
      buffer: ArrayBuffer
    }) => Promise<unknown>
  }
  receipt: {
    print: (payload: { html: string; paperWidthMm?: number }) => Promise<{
      success: boolean
      cancelled?: boolean
    }>
  }
  reports: {
    export: (payload: {
      report: string
      format: 'csv' | 'json'
      query?: Record<string, unknown>
    }) => Promise<{ saved: boolean; path?: string; cancelled?: boolean }>
  }
  app: {
    getConfig: () => Promise<AppRuntimeConfig>
    quit: () => Promise<void>
  }
  startup: {
    getStatus: () => Promise<StartupStatus>
    retry: () => Promise<void>
    onChanged: (listener: (status: StartupStatus) => void) => () => void
  }
  window?: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }
}
