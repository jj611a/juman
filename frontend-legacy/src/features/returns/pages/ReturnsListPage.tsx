import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  createDataColumn,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  Label,
  Page,
  PageActions,
  PageHeader,
  PageToolbar,
  PermissionGuard,
  SearchBar,
  StatusBadge,
  TextInput,
  mapStatus,
  type DataColumnFilter,
  type DataPaginationState,
  type DataRowAction,
  type DataSortingState,
  type FilterFieldDef
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'
import type { ReturnDto } from '@/services/domainTypes'
import { useReturnsList } from '../hooks'
import { RETURN_STATUS_MAP } from '../statusMap'

export default function ReturnsListPage(): React.ReactElement {
  const canView = usePermission('return.view')
  const navigate = useNavigate()
  const [customerQ, setCustomerQ] = React.useState('')
  const [customerId, setCustomerId] = React.useState<string | undefined>()
  const [rentalId, setRentalId] = React.useState('')
  const [filters, setFilters] = React.useState<DataColumnFilter[]>([])
  const [sorting, setSorting] = React.useState<DataSortingState>([
    { id: 'created_at', desc: true }
  ])
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })

  const customers = useQuery({
    queryKey: ['customers', 'list', { q: customerQ, limit: 20 }],
    queryFn: () => apiClient.customers.list({ q: customerQ || undefined, limit: 20 }),
    enabled: customerQ.trim().length >= 2 || Boolean(customerId)
  })
  const customerName = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const c of customers.data?.data ?? []) map.set(c.id, c.full_name)
    return map
  }, [customers.data])

  const statusFilter = filters.find((f) => f.id === 'status')?.value

  const listParams = React.useMemo(
    () => ({
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      status: typeof statusFilter === 'string' && statusFilter !== 'all' ? statusFilter : undefined,
      customer_id: customerId,
      rental_id: rentalId.trim() || undefined,
      sort_by: sorting[0]?.id ?? 'created_at',
      sort_dir: (sorting[0]?.desc ? 'desc' : 'asc') as 'asc' | 'desc'
    }),
    [pagination, statusFilter, customerId, rentalId, sorting]
  )

  const listQuery = useReturnsList(listParams)

  const filterFields = React.useMemo<FilterFieldDef[]>(
    () => [
      {
        id: 'status',
        label: 'الحالة',
        type: 'select',
        options: [
          { value: 'all', label: 'الكل' },
          ...Object.entries(RETURN_STATUS_MAP).map(([value, v]) => ({
            value,
            label: String(v.label)
          }))
        ]
      }
    ],
    []
  )

  const columns = React.useMemo(
    () => [
      createDataColumn<ReturnDto>({
        accessorKey: 'return_number',
        header: 'الرقم',
        sortable: true
      }),
      createDataColumn<ReturnDto>({
        id: 'rental',
        header: 'التأجير',
        cell: ({ row }) => (
          <button
            type="button"
            className="text-brand underline-offset-2 hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              void navigate(`/rentals/${row.rental_id}`)
            }}
          >
            {row.rental_id.slice(0, 8)}
          </button>
        )
      }),
      createDataColumn<ReturnDto>({
        id: 'customer',
        header: 'العميل',
        cell: ({ row }) => customerName.get(row.customer_id) ?? row.customer_id.slice(0, 8)
      }),
      createDataColumn<ReturnDto>({
        id: 'returned_at',
        header: 'وقت الإرجاع',
        cell: ({ row }) => new Date(row.returned_at).toLocaleString('ar-IQ')
      }),
      createDataColumn<ReturnDto>({
        id: 'status',
        header: 'الحالة',
        cell: ({ row }) => {
          const mapped = mapStatus(String(row.status), RETURN_STATUS_MAP)
          return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
        }
      }),
      createDataColumn<ReturnDto>({
        id: 'items',
        header: 'البنود',
        cell: ({ row }) => String(row.items?.length ?? 0)
      })
    ],
    [customerName, navigate]
  )

  const actions = React.useMemo<DataRowAction<ReturnDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'return.view',
        onClick: (row) => void navigate(`/returns/${row.id}`)
      }
    ],
    [navigate]
  )

  if (!canView) return <Navigate to="/forbidden" replace />

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1)

  return (
    <Page size="full" as="main">
      <PageHeader
        title="المرتجعات"
        description="تسجيل استلام الفساتين المؤجرة"
        actions={
          <PageActions>
            <PermissionGuard permission="return.create">
              <Button type="button" onClick={() => void navigate('/returns/new')}>
                مرتجع جديد
              </Button>
            </PermissionGuard>
          </PageActions>
        }
        toolbar={
          <PageToolbar className="items-end">
            <div className="relative min-w-[16rem] flex-[2]">
              <Label htmlFor="returns-customer-search" className="mb-1.5 block">
                العميل
              </Label>
              <SearchBar
                id="returns-customer-search"
                value={customerQ}
                onValueChange={(v) => {
                  setCustomerQ(v)
                  setCustomerId(undefined)
                  setPagination((p) => ({ ...p, pageIndex: 0 }))
                }}
                placeholder="بحث عميل ثم اختيار…"
              />
              {!customerId &&
              customerQ.trim().length >= 2 &&
              (customers.data?.data.length ?? 0) > 0 ? (
                <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border border-border bg-panel shadow-md">
                  {(customers.data?.data ?? []).map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full cursor-pointer px-3 py-2 text-start transition-colors hover:bg-brand-subtle"
                        onClick={() => {
                          setCustomerId(c.id)
                          setCustomerQ(c.full_name)
                          setPagination((p) => ({ ...p, pageIndex: 0 }))
                        }}
                      >
                        {c.full_name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="min-w-[12rem] flex-1">
              <Label htmlFor="returns-rental-id" className="mb-1.5 block">
                معرّف التأجير
              </Label>
              <TextInput
                id="returns-rental-id"
                value={rentalId}
                onChange={(e) => {
                  setRentalId(e.target.value)
                  setPagination((p) => ({ ...p, pageIndex: 0 }))
                }}
                placeholder="اختياري"
              />
            </div>
            <FilterBar fields={filterFields} value={filters} onChange={setFilters} />
          </PageToolbar>
        }
      />
      {listQuery.isError ? (
        <ErrorState title="تعذر تحميل المرتجعات" onRetry={() => void listQuery.refetch()} />
      ) : (
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
          empty={
            <EmptyState
              title="لا مرتجعات"
              description="سجّل مرتجعاً من تأجير نشط للبدء"
              primaryAction={
                <PermissionGuard permission="return.create">
                  <Button type="button" onClick={() => void navigate('/returns/new')}>
                    مرتجع جديد
                  </Button>
                </PermissionGuard>
              }
            />
          }
        />
      )}
    </Page>
  )
}
