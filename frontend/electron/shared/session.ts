export interface SessionUser {
  id: string
  username: string
  displayName?: string | null
  roles?: string[]
  permissions?: string[]
}

export interface SessionView {
  authenticated: boolean
  user: SessionUser | null
  mustChangePassword: boolean
}
