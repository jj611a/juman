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
import type { SaleDto } from '@/services/domainTypes'
import { useSalesList } from '../hooks'
import { SALE_ORIGIN_MAP, SALE_STATUS_MAP } from '../statusMap'

export default function SalesListPage(): React.ReactElement {
  const canView = usePermission('sale.view')
  const navigate = useNavigate()
  const [customerQ, setCustomerQ] = React.useState('')
  const [customerId, setCustomerId] = React.useState<string | undefined>()
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
  const originFilter = filters.find((f) => f.id === 'origin')?.value

  const listParams = React.useMemo(
    () => ({
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      status: typeof statusFilter === 'string' && statusFilter !== 'all' ? statusFilter : undefined,
      origin: typeof originFilter === 'string' && originFilter !== 'all' ? originFilter : undefined,
      customer_id: customerId,
      sort_by: sorting[0]?.id ?? 'created_at',
      sort_dir: (sorting[0]?.desc ? 'desc' : 'asc') as 'asc' | 'desc'
    }),
    [pagination, statusFilter, originFilter, customerId, sorting]
  )

  const listQuery = useSalesList(listParams)

  const filterFields = React.useMemo<FilterFieldDef[]>(
    () => [
      {
        id: 'status',
        label: 'الحالة',
        type: 'select',
        options: [
          { value: 'all', label: 'الكل' },
          ...Object.entries(SALE_STATUS_MAP).map(([value, v]) => ({
            value,
            label: String(v.label)
          }))
        ]
      },
      {
        id: 'origin',
        label: 'المصدر',
        type: 'select',
        options: [
          { value: 'all', label: 'الكل' },
          ...Object.entries(SALE_ORIGIN_MAP).map(([value, v]) => ({
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
      createDataColumn<SaleDto>({
        accessorKey: 'sale_number',
        header: 'الرقم',
        sortable: true
      }),
      createDataColumn<SaleDto>({
        id: 'origin',
        header: 'المصدر',
        cell: ({ row }) => {
          const mapped = mapStatus(String(row.origin), SALE_ORIGIN_MAP)
          return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
        }
      }),
      createDataColumn<SaleDto>({
        id: 'customer',
        header: 'العميل',
        cell: ({ row }) =>
          row.customer_id
            ? (customerName.get(row.customer_id) ?? row.customer_id.slice(0, 8))
            : '—'
      }),
      createDataColumn<SaleDto>({
        id: 'sold_at',
        header: 'وقت البيع',
        sortable: true,
        cell: ({ row }) => new Date(row.sold_at).toLocaleString('ar-IQ')
      }),
      createDataColumn<SaleDto>({
        id: 'total_amount',
        header: 'الإجمالي',
        sortable: true,
        cell: ({ row }) => <MoneyDisplay value={row.total_amount} />
      }),
      createDataColumn<SaleDto>({
        id: 'status',
        header: 'الحالة',
        cell: ({ row }) => {
          const mapped = mapStatus(String(row.status), SALE_STATUS_MAP)
          return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
        }
      }),
      createDataColumn<SaleDto>({
        id: 'items',
        header: 'البنود',
        cell: ({ row }) => String(row.items?.length ?? 0)
      })
    ],
    [customerName]
  )

  const actions = React.useMemo<DataRowAction<SaleDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'sale.view',
        onClick: (row) => void navigate(`/sales/${row.id}`)
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
        title="المبيعات"
        description="فواتير بيع الفساتين"
        actions={
          <PageActions>
            <PermissionGuard permission="sale.create">
              <Button type="button" onClick={() => void navigate('/sales/new')}>
                بيع جديد
              </Button>
            </PermissionGuard>
          </PageActions>
        }
        toolbar={
          <div className="flex w-full flex-col gap-3">
            <SearchBar
              value={customerQ}
              onValueChange={(v) => {
                setCustomerQ(v)
                setCustomerId(undefined)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
              placeholder="بحث عميل ثم اختيار…"
            />
            {!customerId && customerQ.trim().length >= 2 && (customers.data?.data.length ?? 0) > 0 ? (
              <ul className="max-h-40 overflow-auto rounded-md border border-border">
                {(customers.data?.data ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-start hover:bg-brand-subtle"
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
            <FilterBar fields={filterFields} value={filters} onChange={setFilters} />
          </div>
        }
      />
      {listQuery.isError ? (
        <ErrorState title="تعذر تحميل المبيعات" onRetry={() => void listQuery.refetch()} />
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
            empty={<EmptyState title="لا مبيعات" description="أنشئ فاتورة بيع جديدة" />}
          />
        </>
      )}
    </Page>
  )
}
