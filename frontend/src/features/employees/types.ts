export interface UserRole {
  id: string
  name: string
  isActive: boolean
}

export interface Employee {
  id: string
  username: string
  fullName: string
  role: UserRole | null
  isActive: boolean
  isLocked: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface EmployeeListResponse {
  items: Employee[]
  meta: {
    offset: number
    limit: number
    total: number
  }
}

export interface RoleWithPermissions {
  id: string
  name: string
  description: string
  isSystem: boolean
  permissionKeys: string[]
}

export interface CreateEmployeeInput {
  username: string
  fullName: string
  password: string
  roleId: string
  mustChangePassword?: boolean
}

export interface UpdateEmployeeInput {
  fullName?: string
  roleId?: string
}

export interface ResetPasswordInput {
  newPassword: string
}

export interface EmployeeQuery {
  q?: string
  status?: 'active' | 'inactive' | 'locked'
  roleId?: string
  deleted?: boolean
  sortBy?: 'username' | 'fullName' | 'createdAt' | 'updatedAt' | 'lastLoginAt'
  sortDir?: 'asc' | 'desc'
  offset?: number
  limit?: number
}