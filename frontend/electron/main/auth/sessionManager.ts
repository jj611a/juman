import type { AxiosInstance } from 'axios'
import type { BrowserWindow } from 'electron'
import type { CredentialStore } from '../security/credentialStore'
import type { SessionUser, SessionView } from '../../shared/session'
import type { AppError } from '../../shared/errors'
import { IpcChannels } from '../../shared/channels'
import { mapAxiosError } from '../http/errors'

interface TokenData {
  access_token: string
  refresh_token: string
  token_type: string
  access_expires_at?: string
  refresh_expires_at?: string
  session_id?: string
  user: SessionUser & Record<string, unknown>
}

interface Envelope<T> {
  success: boolean
  data?: T
  error?: { code?: string; message?: string; details?: unknown }
  item?: { permissions?: Array<{ key?: string }> } & Record<string, unknown>
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
        if (url.includes('/login') || url.includes('/refresh')) {
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

  private toSessionUser(raw: TokenData['user']): SessionUser {
    return {
      id: String(raw.id),
      username: String(raw.username),
      full_name: (raw.full_name as string | null | undefined) ?? null,
      role_id: raw.role_id != null ? String(raw.role_id) : null,
      is_active: Boolean(raw.is_active ?? true)
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

  private async hydratePermissions(roleId: string | null): Promise<void> {
    if (!roleId) {
      this.permissions = []
      return
    }
    try {
      const response = await this.http.get<Envelope<unknown>>(`/roles/${roleId}`)
      if (response.status >= 400) {
        this.permissions = []
        return
      }
      const body = response.data as Envelope<unknown> & {
        item?: { permissions?: Array<{ key?: string }> }
      }
      const perms = body.item?.permissions ?? []
      this.permissions = perms
        .map((p) => p.key)
        .filter((k): k is string => typeof k === 'string' && k.length > 0)
    } catch {
      this.permissions = []
    }
  }

  async applyTokenData(data: TokenData, options?: { remember?: boolean }): Promise<SessionView> {
    const remember = options?.remember !== false
    this.accessToken = data.access_token
    this.user = this.toSessionUser(data.user)
    this.mustChangePassword = Boolean(data.user.must_change_password)
    if (remember) {
      this.memoryRefreshToken = null
      await this.credentials.setRefreshToken(data.refresh_token)
    } else {
      this.memoryRefreshToken = data.refresh_token
      await this.credentials.clearRefreshToken()
    }
    await this.hydratePermissions(this.user.role_id)
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
    const response = await this.http.post<Envelope<TokenData>>('/login', {
      username,
      password,
      remember_me: remember,
      device_name: options?.deviceName ?? 'Juman Desktop'
    })
    if (response.status >= 400 || !response.data?.success || !response.data.data) {
      const err = response.data?.error
      throw {
        code: err?.code ?? (response.status === 401 ? 'INVALID_CREDENTIALS' : 'HTTP_ERROR'),
        message: err?.message ?? 'تعذر تسجيل الدخول',
        details: err?.details
      } satisfies AppError
    }
    return this.applyTokenData(response.data.data, { remember })
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<SessionView> {
    const response = await this.http.post<Envelope<unknown>>('/change-password', {
      current_password: currentPassword,
      new_password: newPassword
    })
    if (response.status >= 400 || (response.data && 'success' in response.data && response.data.success === false)) {
      const err = (response.data as Envelope<unknown>)?.error
      throw {
        code: err?.code ?? 'HTTP_ERROR',
        message: err?.message ?? 'تعذر تغيير كلمة المرور',
        details: err?.details
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
      const response = await this.http.post<Envelope<TokenData>>('/refresh', {
        refresh_token: refreshToken
      })
      if (response.status >= 400 || !response.data?.success || !response.data.data) {
        await this.clear()
        return false
      }
      await this.applyTokenData(response.data.data, { remember: options?.remember !== false })
      return true
    } catch {
      await this.clear()
      return false
    }
  }

  async logout(): Promise<SessionView> {
    try {
      if (this.accessToken) {
        await this.http.post('/logout')
      }
    } catch {
      // still clear locally
    }
    await this.clear()
    return this.getSessionView()
  }

  async logoutAll(): Promise<SessionView> {
    try {
      if (this.accessToken) {
        await this.http.post('/logout-all')
      }
    } catch {
      // still clear locally
    }
    await this.clear()
    return this.getSessionView()
  }

  async systemHealth(): Promise<unknown> {
    const response = await this.http.get<Envelope<unknown> | Record<string, unknown>>('/health')
    if (response.status >= 400) {
      throw mapAxiosError({
        isAxiosError: true,
        response,
        message: 'health failed',
        code: 'ERR_BAD_RESPONSE'
      })
    }
    const body = response.data as Envelope<unknown>
    if (body && typeof body === 'object' && 'success' in body && body.success && 'data' in body) {
      return body.data
    }
    return response.data
  }

  async systemVersion(): Promise<unknown> {
    const response = await this.http.get<Envelope<unknown> | Record<string, unknown>>('/version')
    if (response.status >= 400) {
      throw mapAxiosError({
        isAxiosError: true,
        response,
        message: 'version failed',
        code: 'ERR_BAD_RESPONSE'
      })
    }
    const body = response.data as Envelope<unknown>
    if (body && typeof body === 'object' && 'success' in body && body.success && 'data' in body) {
      return body.data
    }
    return response.data
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
