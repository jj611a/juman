import { useAuthStore } from '@/stores/authStore'

export function usePermission(key: string): boolean {
  return useAuthStore((s) => s.hasPermission(key))
}

export function useAnyPermission(keys: string[]): boolean {
  return useAuthStore((s) => s.hasAnyPermission(keys))
}

export function useAllPermissions(keys: string[]): boolean {
  return useAuthStore((s) => s.hasAllPermission(keys))
}
