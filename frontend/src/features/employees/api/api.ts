import { apiInvoke } from '@/ipc/api'
import type { Employee, EmployeeListResponse, RoleWithPermissions, CreateEmployeeInput, UpdateEmployeeInput, ResetPasswordInput, EmployeeQuery } from '../types'

const BASE = '/users'

export async function fetchEmployees(query: EmployeeQuery = {}): Promise<EmployeeListResponse> {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value))
    }
  })
  return apiInvoke({ method: 'GET', path: BASE, query: Object.fromEntries(params) })
}

export async function fetchEmployeeById(id: string): Promise<Employee> {
  return apiInvoke({ method: 'GET', path: `${BASE}/${id}` })
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  return apiInvoke({ method: 'POST', path: BASE, body: input })
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  return apiInvoke({ method: 'PATCH', path: `${BASE}/${id}`, body: input })
}

export async function deactivateEmployee(id: string): Promise<Employee> {
  return apiInvoke({ method: 'POST', path: `${BASE}/${id}/deactivate` })
}

export async function activateEmployee(id: string): Promise<Employee> {
  return apiInvoke({ method: 'POST', path: `${BASE}/${id}/activate` })
}

export async function unlockEmployee(id: string): Promise<Employee> {
  return apiInvoke({ method: 'POST', path: `${BASE}/${id}/unlock` })
}

export async function resetEmployeePassword(id: string, input: ResetPasswordInput): Promise<Employee> {
  return apiInvoke({ method: 'POST', path: `${BASE}/${id}/reset-password`, body: input })
}

export async function deleteEmployee(id: string): Promise<Employee> {
  return apiInvoke({ method: 'DELETE', path: `${BASE}/${id}` })
}

export async function restoreEmployee(id: string): Promise<Employee> {
  return apiInvoke({ method: 'POST', path: `${BASE}/${id}/restore` })
}

export async function fetchRoles(): Promise<RoleWithPermissions[]> {
  return apiInvoke({ method: 'GET', path: '/roles' })
}

export async function fetchPermissions(): Promise<Array<{ key: string; displayName: string; description: string; module: string }>> {
  return apiInvoke({ method: 'GET', path: '/permissions' })
}