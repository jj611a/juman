import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import {
  Badge,
  Button,
  createDataColumn,
  DataTable,
  EmptyState,
  ErrorState,
  Page,
  PageActions,
  PageHeader,
  PermissionGuard,
  StatusBadge,
  type DataRowAction
} from '@/components/ui'
import { useAnyPermission } from '@/hooks/usePermission'
import type { RoleDto } from '@/services/domainTypes'
import { useRolesList } from '../hooks'

export default function RolesListPage(): React.ReactElement {
  const canView = useAnyPermission(['roles.view', 'roles.manage'])
  const navigate = useNavigate()
  const listQuery = useRolesList()

  const columns = React.useMemo(
    () => [
      createDataColumn<RoleDto>({
        accessorKey: 'name',
        header: 'الاسم'
      }),
      createDataColumn<RoleDto>({
        accessorKey: 'description',
        header: 'الوصف',
        cell: ({ row }) => row.description ?? '—'
      }),
      createDataColumn<RoleDto>({
        id: 'active',
        header: 'الحالة',
        cell: ({ row }) => (
          <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>
            {row.is_active ? 'نشط' : 'غير نشط'}
          </StatusBadge>
        )
      }),
      createDataColumn<RoleDto>({
        id: 'system',
        header: 'النوع',
        cell: ({ row }) =>
          row.is_system ? (
            <Badge variant="outline">نظام</Badge>
          ) : (
            <span className="text-muted-foreground">مخصص</span>
          )
      }),
      createDataColumn<RoleDto>({
        id: 'permissions',
        header: 'الصلاحيات',
        cell: ({ row }) => String(row.permissions?.length ?? 0)
      })
    ],
    []
  )

  const actions = React.useMemo<DataRowAction<RoleDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'roles.view',
        onClick: (row) => void navigate(`/roles/${row.id}`)
      }
    ],
    [navigate]
  )

  if (!canView) return <Navigate to="/forbidden" replace />

  const rows = listQuery.data?.items ?? []

  return (
    <Page size="full" as="main">
      <PageHeader
        title="الأدوار"
        description="إدارة الأدوار وصلاحيات RBAC"
        actions={
          <PageActions>
            <PermissionGuard anyOf={['roles.create', 'roles.manage']}>
              <Button type="button" onClick={() => void navigate('/roles/new')}>
                دور جديد
              </Button>
            </PermissionGuard>
          </PageActions>
        }
      />

      {listQuery.isError ? (
        <ErrorState
          title="تعذر تحميل الأدوار"
          message="تحقق من الاتصال ثم أعد المحاولة"
          onRetry={() => void listQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.id}
          loading={listQuery.isLoading || listQuery.isFetching}
          actions={actions}
          empty={<EmptyState title="لا توجد أدوار" description="أضف دوراً للبدء" />}
        />
      )}
    </Page>
  )
}
