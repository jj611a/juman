import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchEmployees, fetchEmployeeById, createEmployee, updateEmployee, deactivateEmployee, activateEmployee, unlockEmployee, resetEmployeePassword, deleteEmployee, restoreEmployee, fetchRoles, fetchPermissions } from '../api/api'
import type { Employee, EmployeeQuery, CreateEmployeeInput, UpdateEmployeeInput, ResetPasswordInput, RoleWithPermissions } from '../types'

export function useEmployees(query: EmployeeQuery) {
  return useQuery({
    queryKey: ['employees', query],
    queryFn: () => fetchEmployees(query),
    placeholderData: (prev) => prev,
  })
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: ['employees', 'detail', id],
    queryFn: () => fetchEmployeeById(id!),
    enabled: !!id,
  })
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
  })
}

export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEmployeeInput }) => updateEmployee(id, input),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employees', 'detail', id] })
    },
  })
}

export function useDeactivateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useActivateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: activateEmployee,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useUnlockEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: unlockEmployee,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useResetEmployeePassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResetPasswordInput }) => resetEmployeePassword(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useRestoreEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: restoreEmployee,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}