import type { AxiosInstance } from 'axios'
import type { BrowserWindow } from 'electron'
import { IpcChannels } from '../../shared/channels'
import type { SessionView } from '../../shared/session'
import type { SafeStorageCredentialStore } from '../security/credentialStore'

interface TokenBundle {
  accessToken: string
  refreshToken?: string
  /** When true, the bundle may be persisted (Remember Me). False = session-only. */
  rememberMe: boolean
  user: SessionView['user']
  mustChangePassword: boolean
}

/**
 * Main-process session authority.
 * Renderer receives SessionView only — never raw JWTs.
 */
export class SessionManager {
  private bundle: TokenBundle | null = null

  constructor(
    private readonly http: AxiosInstance,
    private readonly store: SafeStorageCredentialStore,
    private readonly getWindow: () => BrowserWindow | null
  ) {}

  async bootstrap(): Promise<void> {
    const raw = this.store.load()
    if (!raw) {
      this.emit()
      return
    }
    try {
      const parsed = JSON.parse(raw) as TokenBundle
      const headers: Record<string, string> = {}
      if (parsed.accessToken) {
        headers['Authorization'] = `Bearer ${parsed.accessToken}`
      }
      if (parsed.refreshToken) {
        headers['x-refresh-token'] = parsed.refreshToken
      }
      const res = await this.http.get('/auth/session', { headers })
      if (res.status >= 400) {
        this.store.clear()
        this.bundle = null
      } else {
        const data = res.data as {
          tokens?: {
            accessToken: string
            refreshToken?: string
            user: {
              id: string
              username: string
              fullName?: string
              roleName?: string
              mustChangePassword?: boolean
              permissions?: string[]
            }
          }
          session: {
            user: {
              id: string
              username: string
              fullName?: string
              roleName?: string
              mustChangePassword?: boolean
              permissions?: string[]
            }
          }
        }
        if (data.tokens) {
          this.bundle = {
            accessToken: data.tokens.accessToken,
            refreshToken: data.tokens.refreshToken ?? parsed.refreshToken,
            rememberMe: parsed.rememberMe ?? true,
            user: {
              id: data.tokens.user.id,
              username: data.tokens.user.username,
              displayName: data.tokens.user.fullName ?? null,
              roles: data.tokens.user.roleName ? [data.tokens.user.roleName] : [],
              permissions: [...(data.tokens.user.permissions ?? [])]
            },
            mustChangePassword: Boolean(data.tokens.user.mustChangePassword)
          }
          this.persist()
        } else {
          this.bundle = {
            ...parsed,
            rememberMe: parsed.rememberMe ?? true,
            user: {
              id: data.session.user.id,
              username: data.session.user.username,
              displayName: data.session.user.fullName ?? null,
              roles: data.session.user.roleName ? [data.session.user.roleName] : [],
              permissions: [...(data.session.user.permissions ?? [])]
            },
            mustChangePassword: Boolean(data.session.user.mustChangePassword)
          }
          this.persist()
        }
      }
    } catch (err) {
      const status = (err as any)?.response?.status
      if (status && status >= 400 && status < 500) {
        this.store.clear()
        this.bundle = null
      } else {
        try {
          this.bundle = JSON.parse(raw) as TokenBundle
        } catch {
          this.store.clear()
          this.bundle = null
        }
      }
    }
    this.emit()
  }

  view(): SessionView {
    if (!this.bundle) {
      return { authenticated: false, user: null, mustChangePassword: false }
    }
    return {
      authenticated: true,
      user: this.bundle.user,
      mustChangePassword: this.bundle.mustChangePassword
    }
  }

  getAccessToken(): string | null {
    return this.bundle?.accessToken ?? null
  }

  async login(username: string, password: string, rememberMe?: boolean): Promise<SessionView> {
    const res = await this.http.post('/auth/login', {
      username,
      password,
      rememberMe,
      deviceName: 'Juman Desktop'
    })
    if (res.status >= 400) {
      const message =
        (res.data as { message?: string; error?: { message?: string } })?.error?.message ||
        (res.data as { message?: string })?.message ||
        'Login failed'
      const code =
        res.status === 423 ? 'HTTP_423' : res.status === 429 ? 'HTTP_429' : 'AUTH_FAILED'
      throw { code, message, data: res.data }
    }
    const data = res.data as {
      accessToken: string
      refreshToken?: string
      user: {
        id: string
        username: string
        fullName?: string
        mustChangePassword?: boolean
        permissions?: string[]
        roleName?: string
      }
    }
    this.bundle = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      rememberMe: rememberMe === true,
      user: {
        id: data.user.id,
        username: data.user.username,
        displayName: data.user.fullName ?? null,
        roles: data.user.roleName ? [data.user.roleName] : [],
        permissions: [...(data.user.permissions ?? [])]
      },
      mustChangePassword: Boolean(data.user.mustChangePassword)
    }
    this.persist()
    this.emit()
    return this.view()
  }

  async logout(): Promise<SessionView> {
    try {
      if (this.bundle) {
        const headers: Record<string, string> = {}
        if (this.bundle.accessToken) {
          headers['Authorization'] = `Bearer ${this.bundle.accessToken}`
        }
        if (this.bundle.refreshToken) {
          headers['x-refresh-token'] = this.bundle.refreshToken
        }
        await this.http.post('/auth/logout', {}, { headers })
      }
    } catch {
      /* ignore network on logout */
    }
    this.bundle = null
    this.store.clear()
    this.emit()
    return this.view()
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!this.bundle?.accessToken) {
      throw { code: 'UNAUTHORIZED', message: 'No active session' }
    }

    const res = await this.http.post(
      '/auth/change-password',
      { currentPassword, newPassword },
      { headers: { Authorization: `Bearer ${this.bundle.accessToken}` } }
    )
    if (res.status >= 400) {
      const message =
        (res.data as { message?: string; error?: { message?: string } })?.error?.message ||
        (res.data as { message?: string })?.message ||
        'Password change failed'
      throw { code: 'PASSWORD_CHANGE_FAILED', message }
    }
    if (this.bundle) {
      this.bundle.mustChangePassword = false
      this.persist()
      this.emit()
    }
  }

  private persist(): void {
    if (!this.bundle || !this.bundle.rememberMe) {
      this.store.clear()
      return
    }
    this.store.save(JSON.stringify(this.bundle))
  }

  /**
   * Rotate tokens via the backend (GET /auth/session with the refresh token).
   * Called on 401 so a session survives access-token expiry. Returns true when
   * a new access token was obtained.
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.bundle?.refreshToken || !this.bundle.user) return false
    const currentUser = this.bundle.user
    try {
      const res = await this.http.get('/auth/session', {
        headers: { 'x-refresh-token': this.bundle.refreshToken }
      })
      if (res.status >= 400 || !res.data?.tokens?.accessToken) return false
      const tokens = res.data.tokens as {
        accessToken: string
        refreshToken?: string
        user?: {
          id: string
          username: string
          fullName?: string
          roleName?: string
          mustChangePassword?: boolean
          permissions?: string[]
        }
      }
      this.bundle = {
        ...this.bundle,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? this.bundle.refreshToken,
        user: {
          id: tokens.user?.id ?? currentUser.id,
          username: tokens.user?.username ?? currentUser.username,
          displayName: tokens.user?.fullName ?? currentUser.displayName,
          roles: tokens.user?.roleName
            ? [tokens.user.roleName]
            : currentUser.roles,
          permissions: tokens.user?.permissions
            ? [...tokens.user.permissions]
            : currentUser.permissions
        },
        mustChangePassword:
          tokens.user?.mustChangePassword ?? this.bundle.mustChangePassword
      }
      this.persist()
      this.emit()
      return true
    } catch {
      return false
    }
  }

  /** Force local logout (e.g. refresh failed). Best-effort server revocation. */
  async terminate(): Promise<SessionView> {
    try {
      if (this.bundle?.refreshToken) {
        await this.http.post(
          '/auth/logout',
          {},
          { headers: { 'x-refresh-token': this.bundle.refreshToken } }
        )
      }
    } catch {
      /* ignore */
    }
    this.bundle = null
    this.store.clear()
    this.emit()
    return this.view()
  }

  private emit(): void {
    const win = this.getWindow()
    win?.webContents.send(IpcChannels.AUTH_CHANGED, this.view())
  }
}
