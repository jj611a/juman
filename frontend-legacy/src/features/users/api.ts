import { apiClient } from '@/services/apiClient'
import type {
  AdminResetPasswordBody,
  LoginHistoryListParams,
  UserCreateBody,
  UserListParams,
  UserUpdateBody
} from '@/services/domainTypes'

export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: UserListParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  loginHistory: (userId: string, params: LoginHistoryListParams) =>
    [...userKeys.detail(userId), 'login-history', params] as const
}

export const usersApi = {
  list: (params?: UserListParams) => apiClient.users.list(params),
  get: (id: string) => apiClient.users.get(id),
  create: (body: UserCreateBody) => apiClient.users.create(body),
  update: (id: string, body: UserUpdateBody) => apiClient.users.update(id, body),
  deactivate: (id: string) => apiClient.users.deactivate(id),
  activate: (id: string) => apiClient.users.activate(id),
  remove: (id: string) => apiClient.users.remove(id),
  resetPassword: (body: AdminResetPasswordBody) => apiClient.users.resetPassword(body),
  userLoginHistory: (userId: string, params?: LoginHistoryListParams) =>
    apiClient.users.userLoginHistory(userId, params)
}
