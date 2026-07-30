import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import {
  Button,
  createDataColumn,
  DataTable,
  EmptyState,
  ErrorState,
  mapStatus,
  Page,
  PageActions,
  PageHeader,
  PermissionGuard,
  StatusBadge,
  type DataPaginationState,
  type DataRowAction
} from '@/components/ui'
import { useRolesList } from '@/features/roles/hooks'
import { useAnyPermission } from '@/hooks/usePermission'
import type { UserDto } from '@/services/domainTypes'
import { useUsersList } from '../hooks'
import {
  USER_ACTIVE_STATUS_MAP,
  USER_LOCKED_STATUS_MAP,
  userActiveKey,
  userLockedKey
} from '../statusMap'

export default function UsersListPage(): React.ReactElement {
  const canView = useAnyPermission(['users.view', 'users.manage'])
  const navigate = useNavigate()
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })

  const listParams = React.useMemo(
    () => ({
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize
    }),
    [pagination]
  )

  const listQuery = useUsersList(listParams)
  const rolesQuery = useRolesList()

  const roleNameById = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const role of rolesQuery.data?.items ?? []) map.set(role.id, role.name)
    return map
  }, [rolesQuery.data])

  const columns = React.useMemo(
    () => [
      createDataColumn<UserDto>({
        accessorKey: 'username',
        header: 'اسم المستخدم'
      }),
      createDataColumn<UserDto>({
        accessorKey: 'full_name',
        header: 'الاسم الكامل'
      }),
      createDataColumn<UserDto>({
        id: 'role',
        header: 'الدور',
        cell: ({ row }) => roleNameById.get(row.role_id) ?? '—'
      }),
      createDataColumn<UserDto>({
        accessorKey: 'phone',
        header: 'الهاتف',
        cell: ({ row }) => row.phone ?? '—'
      }),
      createDataColumn<UserDto>({
        id: 'active',
        header: 'التفعيل',
        cell: ({ row }) => {
          const mapped = mapStatus(userActiveKey(row.is_active), USER_ACTIVE_STATUS_MAP)
          return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
        }
      }),
      createDataColumn<UserDto>({
        id: 'locked',
        header: 'القفل',
        cell: ({ row }) => {
          const mapped = mapStatus(userLockedKey(row.is_locked), USER_LOCKED_STATUS_MAP)
          return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
        }
      })
    ],
    [roleNameById]
  )

  const actions = React.useMemo<DataRowAction<UserDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'users.view',
        onClick: (row) => void navigate(`/users/${row.id}`)
      }
    ],
    [navigate]
  )

  if (!canView) {
    return <Navigate to="/forbidden" replace />
  }

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pagination.pageSize)))

  return (
    <Page size="full" as="main">
      <PageHeader
        title="المستخدمون"
        description="إدارة حسابات الموظفين والأدوار"
        actions={
          <PageActions>
            <PermissionGuard anyOf={['users.create', 'users.manage']}>
              <Button type="button" onClick={() => void navigate('/users/new')}>
                مستخدم جديد
              </Button>
            </PermissionGuard>
          </PageActions>
        }
      />

      {listQuery.isError ? (
        <ErrorState
          title="تعذر تحميل المستخدمين"
          message="تحقق من الاتصال ثم أعد المحاولة"
          onRetry={() => void listQuery.refetch()}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            manual
            loading={listQuery.isLoading || listQuery.isFetching}
            pagination={pagination}
            onPaginationChange={setPagination}
            pageCount={pageCount}
            totalItems={total}
            actions={actions}
            empty={<EmptyState title="لا يوجد مستخدمون" description="أضف مستخدماً للبدء" />}
          />
        </>
      )}
    </Page>
  )
}
