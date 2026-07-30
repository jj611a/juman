import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import {
  Button,
  ConfirmationDialog,
  createDataColumn,
  DataTable,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  EmptyState,
  ErrorState,
  FilterBar,
  Page,
  PageActions,
  PageHeader,
  PermissionGuard,
  SearchBar,
  StatusBadge,
  type DataColumnFilter,
  type DataPaginationState,
  type DataRowAction,
  type DataSortingState,
  type FilterFieldDef
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import type { CustomerDto } from '@/services/domainTypes'
import { CustomerForm } from '../components/CustomerForm'
import { useCreateCustomer, useCustomersList, useDeleteCustomer } from '../hooks'
import {
  birthDateToIso,
  emptyToNull,
  toE164,
  type CustomerFormValues
} from '../schemas'

type DrawerMode = 'create' | null

const FILTER_FIELDS: FilterFieldDef[] = [
  {
    id: 'active_only',
    label: 'الحالة',
    type: 'select',
    options: [
      { value: 'all', label: 'الكل' },
      { value: 'true', label: 'نشط فقط' }
    ]
  }
]

export default function CustomersListPage(): React.ReactElement {
  const canView = usePermission('customer.view')
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [filters, setFilters] = React.useState<DataColumnFilter[]>([])
  const [sorting, setSorting] = React.useState<DataSortingState>([
    { id: 'created_at', desc: true }
  ])
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })
  const [drawerMode, setDrawerMode] = React.useState<DrawerMode>(null)
  const [formDirty, setFormDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<CustomerDto | null>(null)

  const activeOnly =
    filters.find((f) => f.id === 'active_only')?.value === 'true' ? true : undefined
  const sortBy = sorting[0]?.id ?? 'created_at'
  const sortDir = sorting[0]?.desc ? 'desc' : 'asc'

  const listParams = React.useMemo(
    () => ({
      q: q || undefined,
      active_only: activeOnly,
      sort_by: sortBy,
      sort_dir: sortDir as 'asc' | 'desc',
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize
    }),
    [q, activeOnly, sortBy, sortDir, pagination]
  )

  const listQuery = useCustomersList(listParams)
  const createMutation = useCreateCustomer()
  const deleteMutation = useDeleteCustomer()

  const columns = React.useMemo(
    () => [
      createDataColumn<CustomerDto>({
        accessorKey: 'customer_number',
        header: 'الرقم',
        sortable: true
      }),
      createDataColumn<CustomerDto>({
        accessorKey: 'full_name',
        header: 'الاسم',
        sortable: true
      }),
      createDataColumn<CustomerDto>({
        accessorKey: 'phone',
        header: 'الهاتف'
      }),
      createDataColumn<CustomerDto>({
        id: 'status',
        header: 'الحالة',
        cell: ({ row }) => (
          <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>
            {row.is_active ? 'نشط' : 'غير نشط'}
          </StatusBadge>
        )
      })
    ],
    []
  )

  const requestCloseDrawer = (): void => {
    if (formDirty) {
      setDiscardOpen(true)
      return
    }
    setDrawerMode(null)
    setFormDirty(false)
  }

  const forceCloseDrawer = (): void => {
    setDiscardOpen(false)
    setDrawerMode(null)
    setFormDirty(false)
  }

  const actions = React.useMemo<DataRowAction<CustomerDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'customer.view',
        onClick: (row) => void navigate(`/customers/${row.id}`)
      },
      {
        id: 'delete',
        label: 'حذف',
        icon: 'Trash2',
        tone: 'danger',
        permission: 'customer.delete',
        onClick: (row) => setDeleteTarget(row)
      }
    ],
    [navigate]
  )

  const handleCreate = async (values: CustomerFormValues): Promise<void> => {
    const created = await createMutation.mutateAsync({
      full_name: values.full_name,
      phone: toE164(values.phone),
      alternative_phone: emptyToNull(values.alternative_phone)
        ? toE164(values.alternative_phone)
        : null,
      address: emptyToNull(values.address),
      national_id: emptyToNull(values.national_id),
      notes: emptyToNull(values.notes),
      gender: emptyToNull(values.gender),
      birth_date: birthDateToIso(values.birth_date),
      is_active: values.is_active
    })
    forceCloseDrawer()
    void navigate(`/customers/${created.data.id}`)
  }

  if (!canView) {
    return <Navigate to="/forbidden" replace />
  }

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pagination.pageSize)))

  return (
    <Page size="full" as="main">
      <PageHeader
        title="العملاء"
        description="سجل العملاء وأرقام التواصل"
        actions={
          <PageActions>
            <PermissionGuard permission="customer.create">
              <Button type="button" onClick={() => setDrawerMode('create')}>
                عميل جديد
              </Button>
            </PermissionGuard>
          </PageActions>
        }
        toolbar={
          <div className="flex w-full flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <SearchBar value={q} onValueChange={setQ} placeholder="بحث بالاسم أو الهاتف أو الرقم…" />
            </div>
            <FilterBar fields={FILTER_FIELDS} value={filters} onChange={setFilters} />
          </div>
        }
      />

      {listQuery.isError ? (
        <ErrorState
          title="تعذر تحميل العملاء"
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
            sorting={sorting}
            onSortingChange={(next) => {
              setSorting(next)
              setPagination((p) => ({ ...p, pageIndex: 0 }))
            }}
            pagination={pagination}
            onPaginationChange={setPagination}
            pageCount={pageCount}
            totalItems={total}
            actions={actions}
            empty={<EmptyState title="لا يوجد عملاء" description="أضف عميلاً للبدء" />}
          />
        </>
      )}

      <Drawer
        open={drawerMode != null}
        onOpenChange={(open) => {
          if (!open) requestCloseDrawer()
        }}
      >
        <DrawerContent side="right" size="md">
          <DrawerHeader>
            <DrawerTitle>عميل جديد</DrawerTitle>
            <DrawerDescription>أدخل بيانات العميل</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            {drawerMode === 'create' ? (
              <CustomerForm
                mode="create"
                submitting={createMutation.isPending}
                onSubmit={handleCreate}
                onCancel={requestCloseDrawer}
                onDirtyChange={setFormDirty}
              />
            ) : null}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <ConfirmationDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="تغييرات غير محفوظة"
        description="لديك تعديلات لم تُحفظ. هل تريد الإغلاق دون حفظ؟"
        confirmLabel="إغلاق"
        cancelLabel="البقاء"
        tone="danger"
        onConfirm={forceCloseDrawer}
      />

      <ConfirmationDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="حذف العميل"
        description={
          deleteTarget
            ? `هل تريد حذف «${deleteTarget.full_name}» (${deleteTarget.customer_number})؟ هذا حذف ناعم.`
            : null
        }
        confirmLabel="حذف"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteMutation.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </Page>
  )
}
