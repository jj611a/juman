import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { cn } from '@/shared/utils/cn'
import type { Employee, EmployeeQuery, RoleWithPermissions } from '../types'
import { useEmployees } from '../hooks/useEmployees'
import { useRoles } from '../hooks/useEmployees'

interface EmployeeTableProps {
  initialQuery?: EmployeeQuery
}

export function EmployeeTable({ initialQuery }: EmployeeTableProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState<EmployeeQuery>({
    offset: 0,
    limit: 20,
    sortBy: 'createdAt',
    sortDir: 'desc',
    ...initialQuery,
  })
  const [rowSelection, setRowSelection] = useState<Set<string>>(new Set())
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'locked' | ''>('')
  const selectAllRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, error, refetch } = useEmployees(query)
  const { data: rolesData } = useRoles()

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = rowSelection.size > 0 && rowSelection.size < (data?.items.length ?? 0)
    }
  }, [rowSelection, data?.items.length])

  const handleQueryChange = (newQuery: Partial<EmployeeQuery>) => {
    setQuery((prev) => ({ ...prev, ...newQuery, offset: 0 }))
  }

  const handlePageChange = (offset: number, limit: number) => {
    setQuery((prev) => ({ ...prev, offset, limit }))
  }

  const handleSort = (field: EmployeeQuery['sortBy']) => {
    setQuery((prev) => ({
      ...prev,
      sortBy: field,
      sortDir: prev.sortBy === field && prev.sortDir === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleRowClick = (id: string) => {
    navigate(`/employees/${id}`)
  }

  const handleSelectionChange = (id: string, checked: boolean) => {
    setRowSelection((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleSelectAll = (checked: boolean, items: Employee[]) => {
    setRowSelection(checked ? new Set(items.map((i) => i.id)) : new Set())
  }

  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="table w-full" role="grid">
          <thead>
            <tr>
              <th><input type="checkbox" className="checkbox" disabled /></th>
              <th>اسم المستخدم</th>
              <th>الاسم الكامل</th>
              <th>الدور</th>
              <th>الحالة</th>
              <th>آخر دخول</th>
              <th>إنشاء</th>
              <th className="text-right">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td><input type="checkbox" className="checkbox" disabled /></td>
                <td><div className="h-4 bg-base-content/10 rounded w-24" /></td>
                <td><div className="h-4 bg-base-content/10 rounded w-32" /></td>
                <td><div className="h-4 bg-base-content/10 rounded w-20" /></td>
                <td><div className="h-4 bg-base-content/10 rounded w-16" /></td>
                <td><div className="h-4 bg-base-content/10 rounded w-28" /></td>
                <td><div className="h-4 bg-base-content/10 rounded w-28" /></td>
                <td className="text-right"><div className="h-6 bg-base-content/10 rounded w-24" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        <span>فشل تحميل الموظفين: {(error as Error).message}</span>
        <button className="btn btn-sm btn-ghost" onClick={() => refetch()}>إعادة المحاولة</button>
      </div>
    )
  }

  const items = data?.items ?? []
  const total = data?.meta.total ?? 0
  const roles = rolesData ?? []

  const getStatusBadge = (emp: Employee) => {
    if (emp.deletedAt) return <span className="badge badge-ghost">محذوف</span>
    if (emp.isLocked) return <span className="badge badge-error">مقفل</span>
    if (!emp.isActive) return <span className="badge badge-warning">غير نشط</span>
    return <span className="badge badge-success">نشط</span>
  }

  const getRoleName = (roleId: string | null) => {
    if (!roleId) return '—'
    const role = roles.find((r) => r.id === roleId)
    return role?.name ?? roleId
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-3 bg-base-200/50 rounded-xl border border-base-content/10">
        <div className="flex-1 min-w-[200px]">
          <label className="input input-bordered flex items-center gap-2">
            <svg className="h-5 w-5 text-base-content/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="search"
              placeholder="بحث بالاسم أو المستخدم..."
              value={query.q ?? ''}
              onChange={(e) => handleQueryChange({ q: e.target.value || undefined })}
              className="bg-transparent border-none focus:outline-none flex-1"
            />
          </label>
        </div>
        <select
          className="select select-bordered w-[160px]"
          value={statusFilter}
          onChange={(e) => {
            const val = e.target.value as 'active' | 'inactive' | 'locked' | ''
            setStatusFilter(val)
            handleQueryChange({ status: val || undefined })
          }}
        >
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
          <option value="locked">مقفل</option>
        </select>
        <select
          className="select select-bordered w-[180px]"
          value={roleFilter}
          onChange={(e) => {
            const val = e.target.value
            setRoleFilter(val)
            handleQueryChange({ roleId: val || undefined })
          }}
        >
          <option value="">كل الأدوار</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <label className="input input-bordered flex items-center gap-2" style={{ minWidth: '160px' }}>
          <span className="text-xs text-base-content/60">عرض</span>
          <select
            className="bg-transparent border-none focus:outline-none w-20"
            value={query.limit ?? 20}
            onChange={(e) => handleQueryChange({ limit: Number(e.target.value) })}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-base-content/10 bg-base-200/30">
        <table className="table w-full" role="grid">
          <thead className="bg-base-200/50">
            <tr>
              <th className="w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="checkbox"
                  checked={items.length > 0 && rowSelection.size === items.length}
                  onChange={(e) => handleSelectAll(e.target.checked, items)}
                />
              </th>
              <th className="cursor-pointer" onClick={() => handleSort('username')}>
                اسم المستخدم
                {query.sortBy === 'username' && (query.sortDir === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th className="cursor-pointer" onClick={() => handleSort('fullName')}>
                الاسم الكامل
                {query.sortBy === 'fullName' && (query.sortDir === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th>الدور</th>
              <th>الحالة</th>
              <th className="cursor-pointer" onClick={() => handleSort('lastLoginAt')}>
                آخر دخول
                {query.sortBy === 'lastLoginAt' && (query.sortDir === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th className="cursor-pointer" onClick={() => handleSort('createdAt')}>
                إنشاء
                {query.sortBy === 'createdAt' && (query.sortDir === 'asc' ? ' ▲' : ' ▼')}
              </th>
              <th className="text-right w-32">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-base-content/60">
                  لا يوجد موظفون
                </td>
              </tr>
            ) : (
              items.map((emp) => (
                <tr
                  key={emp.id}
                  className={cn(
                    'transition-colors',
                    emp.deletedAt && 'opacity-50 bg-base-300/50',
                    rowSelection.has(emp.id) && 'bg-primary/10'
                  )}
                  onClick={(e) => {
                    const target = e.target as Element
                    if (
                      target instanceof HTMLInputElement ||
                      target instanceof HTMLButtonElement ||
                      target.closest('button')
                    ) return
                    handleRowClick(emp.id)
                  }}
                >
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={rowSelection.has(emp.id)}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleSelectionChange(emp.id, e.target.checked)
                      }}
                    />
                  </td>
                  <td className="font-mono text-sm">{emp.username}</td>
                  <td className="font-medium">{emp.fullName}</td>
                  <td>{getRoleName(emp.role?.id ?? null)}</td>
                  <td>{getStatusBadge(emp)}</td>
                  <td className="text-sm text-base-content/70">
                    {emp.lastLoginAt ? new Date(emp.lastLoginAt).toLocaleString('ar-SA') : '—'}
                  </td>
                  <td className="text-sm text-base-content/70">
                    {new Date(emp.createdAt).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="text-right">
                    <div className="dropdown dropdown-end">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square juman-focus"
                        onClick={(e) => e.stopPropagation()}
                      >
                        ⋮
                      </button>
                      <ul tabIndex={0} className="dropdown-content menu z-50 mt-2 w-48 rounded-box border border-base-content/10 bg-base-200 p-2 shadow">
                        <li>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost justify-start gap-2 w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/employees/${emp.id}`)
                            }}
                          >
                            عرض التفاصيل
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost justify-start gap-2 w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/employees/${emp.id}`)
                            }}
                          >
                            تعديل
                          </button>
                        </li>
                        {emp.isLocked ? (
                          <li>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost justify-start gap-2 w-full text-warning"
                              onClick={(e) => e.stopPropagation()}
                            >
                              إلغاء القفل
                            </button>
                          </li>
                        ) : null}
                        {emp.isActive && !emp.deletedAt ? (
                          <li>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost justify-start gap-2 w-full text-error"
                              onClick={(e) => e.stopPropagation()}
                            >
                              إلغاء تفعيل
                            </button>
                          </li>
                        ) : !emp.deletedAt ? (
                          <li>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost justify-start gap-2 w-full text-success"
                              onClick={(e) => e.stopPropagation()}
                            >
                              تفعيل
                            </button>
                          </li>
                        ) : null}
                        {emp.deletedAt ? (
                          <li>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost justify-start gap-2 w-full text-info"
                              onClick={(e) => e.stopPropagation()}
                            >
                              استعادة
                            </button>
                          </li>
                        ) : (
                          <li>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost justify-start gap-2 w-full text-error"
                              onClick={(e) => e.stopPropagation()}
                            >
                              حذف
                            </button>
                          </li>
                        )}
                      </ul>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-base-content/60">
            عرض {(query.offset ?? 0) + 1}–{Math.min((query.offset ?? 0) + (query.limit ?? 20), total)} من {total}
          </p>
          <div className="flex gap-1">
            <button
              className="btn btn-sm btn-ghost"
              disabled={(query.offset ?? 0) === 0}
              onClick={() => handlePageChange(Math.max(0, (query.offset ?? 0) - (query.limit ?? 20)), query.limit ?? 20)}
            >
              السابق
            </button>
            <button
              className="btn btn-sm btn-ghost"
              disabled={(query.offset ?? 0) + (query.limit ?? 20) >= total}
              onClick={() => handlePageChange((query.offset ?? 0) + (query.limit ?? 20), query.limit ?? 20)}
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  )
}