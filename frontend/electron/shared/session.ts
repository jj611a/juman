/** Session view exposed to the renderer — never includes JWTs. */
export interface SessionUser {
  id: string
  username: string
  full_name: string | null
  role_id: string | null
  is_active: boolean
}

export interface SessionView {
  authenticated: boolean
  user?: SessionUser
  permissions: string[]
  /** When true, renderer must show force-password-change before shell. */
  mustChangePassword?: boolean
}
