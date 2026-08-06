import type { AxiosInstance } from 'axios'
import type { BrowserWindow } from 'electron'
import type { CredentialStore } from '../security/credentialStore'
import type { SessionUser, SessionView } from '../../shared/session'
import type { AppError } from '../../shared/errors'
import { IpcChannels } from '../../shared/channels'
import { mapAxiosError, messageFromNestBody } from '../http/errors'

/** Nest Backend V2 auth token payload (camelCase, no envelope). */
interface V2TokenPayload {
  accessToken: string
  refreshToken: string
  tokenType: string
  accessExpiresAt?: string
  refreshExpiresAt?: string
  sessionId?: string
  user: {
    id: string
    username: string
    fullName?: string | null
    roleId?: string | null
    roleName?: string | null
    mustChangePassword?: boolean
    isActive?: boolean
    permissions?: string[]
  }
}

interface V2SessionRestore {
  tokens?: V2TokenPayload
  session?: {
    user?: V2TokenPayload['user']
  }
}

export class SessionManager {
  private accessToken: string | null = null
  private user: SessionUser | null = null
  private permissions: string[] = []
  private mustChangePassword = false
  /** In-memory refresh when remember=false (not written to CredentialStore). */
  private memoryRefreshToken: string | null = null
  private refreshPromise: Promise<boolean> | null = null
  private getMainWindow: () => BrowserWindow | null

  constructor(
    private readonly http: AxiosInstance,
    private readonly credentials: CredentialStore,
    getMainWindow: () => BrowserWindow | null
  ) {
    this.getMainWindow = getMainWindow
    this.installInterceptors()
  }

  private installInterceptors(): void {
    this.http.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers = config.headers ?? {}
        config.headers.Authorization = `Bearer ${this.accessToken}`
      }
      return config
    })

    this.http.interceptors.response.use(
      async (response) => {
        if (response.status !== 401) {
          return response
        }
        const url = response.config.url ?? ''
        if (url.includes('/auth/login') || url.includes('/auth/session')) {
          return response
        }
        const refreshed = await this.refresh()
        if (!refreshed) {
          return response
        }
        const retryConfig = { ...response.config }
        retryConfig.headers = retryConfig.headers ?? {}
        retryConfig.headers.Authorization = `Bearer ${this.accessToken}`
        return this.http.request(retryConfig)
      },
      (error) => Promise.reject(error)
    )
  }

  private toSessionUser(raw: V2TokenPayload['user']): SessionUser {
    return {
      id: String(raw.id),
      username: String(raw.username),
      full_name: raw.fullName ?? null,
      role_id: raw.roleId != null ? String(raw.roleId) : null,
      is_active: Boolean(raw.isActive ?? true)
    }
  }

  private emitChanged(): void {
    const win = this.getMainWindow()
    win?.webContents.send(IpcChannels.AUTH_CHANGED, this.getSessionView())
  }

  getSessionView(): SessionView {
    if (!this.accessToken || !this.user) {
      return { authenticated: false, permissions: [], mustChangePassword: false }
    }
    return {
      authenticated: true,
      user: this.user,
      permissions: [...this.permissions],
      mustChangePassword: this.mustChangePassword
    }
  }

  isAuthenticated(): boolean {
    return Boolean(this.accessToken && this.user)
  }

  setPermissions(permissions: string[]): void {
    this.permissions = [...permissions]
    this.emitChanged()
  }

  async applyTokenData(
    data: V2TokenPayload,
    options?: { remember?: boolean }
  ): Promise<SessionView> {
    const remember = options?.remember !== false
    this.accessToken = data.accessToken
    this.user = this.toSessionUser(data.user)
    this.mustChangePassword = Boolean(data.user.mustChangePassword)
    this.permissions = Array.isArray(data.user.permissions)
      ? data.user.permissions.filter((p): p is string => typeof p === 'string')
      : []
    if (remember) {
      this.memoryRefreshToken = null
      await this.credentials.setRefreshToken(data.refreshToken)
    } else {
      this.memoryRefreshToken = data.refreshToken
      await this.credentials.clearRefreshToken()
    }
    this.emitChanged()
    return this.getSessionView()
  }

  async clear(localOnly = false): Promise<void> {
    this.accessToken = null
    this.user = null
    this.permissions = []
    this.mustChangePassword = false
    this.memoryRefreshToken = null
    await this.credentials.clearRefreshToken()
    this.emitChanged()
    void localOnly
  }

  async bootstrap(): Promise<SessionView> {
    const refreshToken = await this.credentials.getRefreshToken()
    if (!refreshToken) {
      return this.getSessionView()
    }
    const ok = await this.refreshWithToken(refreshToken, { remember: true })
    if (!ok) {
      await this.clear()
    }
    return this.getSessionView()
  }

  async login(
    username: string,
    password: string,
    options?: { remember?: boolean; deviceName?: string }
  ): Promise<SessionView> {
    const remember = options?.remember ?? true
    const response = await this.http.post<V2TokenPayload>('/auth/login', {
      username,
      password,
      rememberMe: remember,
      deviceName: options?.deviceName ?? 'Juman Desktop'
    })
    if (response.status >= 400 || !response.data?.accessToken) {
      throw {
        code: response.status === 401 ? 'INVALID_CREDENTIALS' : 'HTTP_ERROR',
        message: messageFromNestBody(response.data) ?? 'تعذر تسجيل الدخول',
        details: response.data
      } satisfies AppError
    }
    return this.applyTokenData(response.data, { remember })
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<SessionView> {
    const response = await this.http.post('/auth/change-password', {
      currentPassword,
      newPassword
    })
    if (response.status >= 400) {
      throw {
        code: 'HTTP_ERROR',
        message: messageFromNestBody(response.data) ?? 'تعذر تغيير كلمة المرور',
        details: response.data
      } satisfies AppError
    }
    this.mustChangePassword = false
    this.emitChanged()
    return this.getSessionView()
  }

  async refresh(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }
    this.refreshPromise = (async () => {
      const refreshToken =
        this.memoryRefreshToken ?? (await this.credentials.getRefreshToken())
      if (!refreshToken) {
        await this.clear()
        return false
      }
      const remember = !this.memoryRefreshToken
      return this.refreshWithToken(refreshToken, { remember })
    })().finally(() => {
      this.refreshPromise = null
    })
    return this.refreshPromise
  }

  private async refreshWithToken(
    refreshToken: string,
    options?: { remember?: boolean }
  ): Promise<boolean> {
    try {
      // Nest V2 rotates via GET /auth/session + X-Refresh-Token (no /refresh).
      const response = await this.http.get<V2SessionRestore>('/auth/session', {
        headers: { 'X-Refresh-Token': refreshToken }
      })
      if (response.status >= 400 || !response.data?.tokens?.accessToken) {
        await this.clear()
        return false
      }
      await this.applyTokenData(response.data.tokens, {
        remember: options?.remember !== false
      })
      return true
    } catch {
      await this.clear()
      return false
    }
  }

  async logout(): Promise<SessionView> {
    try {
      if (this.accessToken) {
        await this.http.post('/auth/logout')
      }
    } catch {
      // still clear locally
    }
    await this.clear()
    return this.getSessionView()
  }

  async logoutAll(): Promise<SessionView> {
    // V2 has no logout-all yet — clear local session (and revoke current via logout).
    return this.logout()
  }

  async systemHealth(): Promise<unknown> {
    const response = await this.http.get<Record<string, unknown>>('/health')
    if (response.status >= 400) {
      throw mapAxiosError({
        isAxiosError: true,
        response,
        message: 'health failed',
        code: 'ERR_BAD_RESPONSE'
      })
    }
    return response.data
  }

  async systemVersion(): Promise<unknown> {
    // V2 exposes version on /health (no dedicated /version route yet).
    const health = (await this.systemHealth()) as { version?: string }
    return { version: health.version ?? '2.0.0', api: 'backend-node' }
  }

  asAppError(error: unknown): AppError {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      typeof (error as AppError).code === 'string'
    ) {
      return error as AppError
    }
    return mapAxiosError(error)
  }
}
