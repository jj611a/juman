import type { SessionView } from '@shared/session'

/** Renderer → Main auth surface. Tokens never enter renderer storage. */
export const ipcAuth = {
  getSession(): Promise<SessionView> {
    return window.juman.auth.getSession()
  },
  login(payload: { username: string; password: string; remember?: boolean }): Promise<SessionView> {
    return window.juman.auth.login(payload)
  },
  logout(): Promise<SessionView> {
    return window.juman.auth.logout()
  },
  onChanged(listener: (session: SessionView) => void): () => void {
    return window.juman.auth.onChanged(listener)
  }
}
