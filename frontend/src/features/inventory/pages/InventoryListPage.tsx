import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  BarcodeScannerField,
  Button,
  ConfirmationDialog,
  createDataColumn,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  MoneyDisplay,
  Page,
  PageActions,
  PageHeader,
  PermissionGuard,
  SearchBar,
  StatusBadge,
  mapStatus,
  type DataColumnFilter,
  type DataPaginationState,
  type DataRowAction,
  type DataSortingState,
  type FilterFieldDef
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import type { DressDto } from '@/services/domainTypes'
import { useDeleteDress, useDressesList } from '../hooks'
import { DRESS_STATUS_MAP } from '../statusMap'
import { inventoryApi } from '../api'
import { toast } from '@/components/ui/toast'
import { toastAppError } from '@/lib/errors/appError'

export default function InventoryListPage(): React.ReactElement {
  const canView = usePermission('inventory.view')
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [barcodeExact, setBarcodeExact] = React.useState('')
  const [filters, setFilters] = React.useState<DataColumnFilter[]>([])
  const [sorting, setSorting] = React.useState<DataSortingState>([
    { id: 'created_at', desc: true }
  ])
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})
  const [deleteTarget, setDeleteTarget] = React.useState<DressDto | null>(null)

  const categories = useQuery({
    queryKey: ['categories', 'list', { limit: 200 }],
    queryFn: () => apiClient.categories.list({ limit: 200 })
  })
  const categoryName = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categories.data?.data ?? []) map.set(c.id, c.name_ar)
    return map
  }, [categories.data])

  const statusFilter = filters.find((f) => f.id === 'status')?.value
  const categoryFilter = filters.find((f) => f.id === 'category_id')?.value
  const activeFilter = filters.find((f) => f.id === 'is_active')?.value

  const listParams = React.useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      page_size: pagination.pageSize,
      q: q || undefined,
      barcode: barcodeExact.trim() || undefined,
      category_id: typeof categoryFilter === 'string' && categoryFilter !== 'all' ? categoryFilter : undefined,
      status: typeof statusFilter === 'string' && statusFilter !== 'all' ? statusFilter : undefined,
      is_active:
        activeFilter === 'true' ? true : activeFilter === 'false' ? false : undefined,
      sort_by: sorting[0]?.id ?? 'created_at',
      sort_dir: (sorting[0]?.desc ? 'desc' : 'asc') as 'asc' | 'desc'
    }),
    [pagination, q, barcodeExact, categoryFilter, statusFilter, activeFilter, sorting]
  )

  const listQuery = useDressesList(listParams)
  const deleteMutation = useDeleteDress()

  const filterFields = React.useMemo<FilterFieldDef[]>(
    () => [
      {
        id: 'category_id',
        label: 'الفئة',
        type: 'select',
        options: [
          { value: 'all', label: 'الكل' },
          ...(categories.data?.data ?? []).map((c) => ({ value: c.id, label: c.name_ar }))
        ]
      },
      {
        id: 'status',
        label: 'الحالة',
        type: 'select',
        options: [
          { value: 'all', label: 'الكل' },
          ...Object.entries(DRESS_STATUS_MAP).map(([value, v]) => ({
            value,
            label: String(v.label)
          }))
        ]
      },
      {
        id: 'is_active',
        label: 'التفعيل',
        type: 'select',
        options: [
          { value: 'all', label: 'الكل' },
          { value: 'true', label: 'نشط' },
          { value: 'false', label: 'غير نشط' }
        ]
      }
    ],
    [categories.data]
  )

  const columns = React.useMemo(
    () => [
      createDataColumn<DressDto>({
        accessorKey: 'barcode',
        header: 'الباركود',
        sortable: true
      }),
      createDataColumn<DressDto>({
        accessorKey: 'name_ar',
        header: 'الاسم',
        sortable: true
      }),
      createDataColumn<DressDto>({
        id: 'category',
        header: 'الفئة',
        cell: ({ row }) => categoryName.get(row.category_id) ?? '—'
      }),
      createDataColumn<DressDto>({
        id: 'status',
        header: 'الحالة',
        cell: ({ row }) => {
          const mapped = mapStatus(String(row.status), DRESS_STATUS_MAP)
          return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
        }
      }),
      createDataColumn<DressDto>({
        id: 'rental',
        header: 'إيجار يومي',
        cell: ({ row }) => <MoneyDisplay value={row.default_daily_rental_price} />
      }),
      createDataColumn<DressDto>({
        id: 'active',
        header: 'نشط',
        cell: ({ row }) => (row.is_active ? 'نعم' : 'لا')
      })
    ],
    [categoryName]
  )

  const actions = React.useMemo<DataRowAction<DressDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'inventory.view',
        onClick: (row) => void navigate(`/inventory/${row.id}`)
      },
      {
        id: 'edit',
        label: 'تعديل',
        icon: 'Pencil',
        permission: 'inventory.update',
        onClick: (row) => void navigate(`/inventory/${row.id}/edit`)
      },
      {
        id: 'delete',
        label: 'حذف',
        icon: 'Trash2',
        tone: 'danger',
        permission: 'inventory.delete',
        onClick: (row) => setDeleteTarget(row)
      }
    ],
    [navigate]
  )

  if (!canView) return <Navigate to="/forbidden" replace />

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total ?? 0
  const pageCount = Math.max(1, listQuery.data?.meta.pages ?? 1)

  return (
    <Page size="full" as="main">
      <PageHeader
        title="المخزون"
        description="فساتين الإيجار والبيع"
        actions={
          <PageActions>
            <PermissionGuard permission="inventory.create">
              <Button type="button" onClick={() => void navigate('/inventory/new')}>
                فستان جديد
              </Button>
            </PermissionGuard>
          </PageActions>
        }
        toolbar={
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <SearchBar value={q} onValueChange={setQ} placeholder="بحث بالاسم أو الباركود…" />
              <BarcodeScannerField
                value={barcodeExact}
                onValueChange={setBarcodeExact}
                onScanRequest={async () => {
                  const code = barcodeExact.trim()
                  if (!code) return
                  try {
                    const res = await inventoryApi.getByBarcode(code)
                    void navigate(`/inventory/${res.data.id}`)
                  } catch (err) {
                    toastAppError(err, 'لم يُعثر على الباركود')
                  }
                }}
                placeholder="باركود دقيق"
                className="max-w-xs"
              />
            </div>
            <FilterBar fields={filterFields} value={filters} onChange={setFilters} />
          </div>
        }
      />

      {listQuery.isError ? (
        <ErrorState
          title="تعذر تحميل المخزون"
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
            enableRowSelection
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
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
            empty={<EmptyState title="لا توجد فساتين" description="أضف فستاناً للبدء" />}
          />
        </>
      )}

      <ConfirmationDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف الفستان"
        description={
          deleteTarget
            ? `هل تريد حذف «${deleteTarget.name_ar}» (${deleteTarget.barcode})؟ هذا حذف ناعم.`
            : null
        }
        confirmLabel="حذف"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteMutation.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
          toast.success('تم الحذف')
        }}
      />
    </Page>
  )
}
