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
import type { RentalDto } from '@/services/domainTypes'
import { useRentalsList } from '../hooks'
import { RENTAL_STATUS_MAP } from '../statusMap'

export default function RentalsListPage(): React.ReactElement {
  const canView = usePermission('rental.view')
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

  const listParams = React.useMemo(
    () => ({
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      status: typeof statusFilter === 'string' && statusFilter !== 'all' ? statusFilter : undefined,
      customer_id: customerId,
      sort_by: sorting[0]?.id ?? 'created_at',
      sort_dir: (sorting[0]?.desc ? 'desc' : 'asc') as 'asc' | 'desc'
    }),
    [pagination, statusFilter, customerId, sorting]
  )

  const listQuery = useRentalsList(listParams)

  const filterFields = React.useMemo<FilterFieldDef[]>(
    () => [
      {
        id: 'status',
        label: 'الحالة',
        type: 'select',
        options: [
          { value: 'all', label: 'الكل' },
          ...Object.entries(RENTAL_STATUS_MAP).map(([value, v]) => ({
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
      createDataColumn<RentalDto>({
        accessorKey: 'rental_number',
        header: 'الرقم',
        sortable: true
      }),
      createDataColumn<RentalDto>({
        id: 'customer',
        header: 'العميل',
        cell: ({ row }) => customerName.get(row.customer_id) ?? row.customer_id.slice(0, 8)
      }),
      createDataColumn<RentalDto>({
        id: 'rental_at',
        header: 'التسليم',
        cell: ({ row }) => new Date(row.rental_at).toLocaleDateString('ar-IQ')
      }),
      createDataColumn<RentalDto>({
        id: 'expected_return_at',
        header: 'الإعادة',
        cell: ({ row }) => new Date(row.expected_return_at).toLocaleDateString('ar-IQ')
      }),
      createDataColumn<RentalDto>({
        id: 'status',
        header: 'الحالة',
        cell: ({ row }) => {
          const mapped = mapStatus(String(row.status), RENTAL_STATUS_MAP)
          return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
        }
      }),
      createDataColumn<RentalDto>({
        id: 'estimated_total',
        header: 'الإجمالي التقديري',
        cell: ({ row }) => <MoneyDisplay value={row.estimated_total} />
      }),
      createDataColumn<RentalDto>({
        id: 'remaining_balance',
        header: 'المتبقي',
        cell: ({ row }) => <MoneyDisplay value={row.remaining_balance} />
      })
    ],
    [customerName]
  )

  const actions = React.useMemo<DataRowAction<RentalDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'rental.view',
        onClick: (row) => void navigate(`/rentals/${row.id}`)
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
        title="التأجير"
        description="تسليم الفساتين والمدفوعات الأولية"
        actions={
          <PageActions>
            <PermissionGuard permission="rental.create">
              <Button type="button" onClick={() => void navigate('/rentals/new')}>
                تأجير جديد
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
        <ErrorState title="تعذر تحميل التأجير" onRetry={() => void listQuery.refetch()} />
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
            empty={<EmptyState title="لا تأجيرات" description="أنشئ تأجيراً للبدء" />}
          />
        </>
      )}
    </Page>
  )
}
