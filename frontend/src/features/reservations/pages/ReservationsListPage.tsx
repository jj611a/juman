import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  ConfirmationDialog,
  createDataColumn,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
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
import type { ReservationDto } from '@/services/domainTypes'
import { useCancelReservation, useConfirmReservation, useReservationsList } from '../hooks'
import { RESERVATION_STATUS_MAP } from '../statusMap'

export default function ReservationsListPage(): React.ReactElement {
  const canView = usePermission('reservation.view')
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
  const [cancelTarget, setCancelTarget] = React.useState<ReservationDto | null>(null)

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

  const listQuery = useReservationsList(listParams)
  const confirmMutation = useConfirmReservation()
  const cancelMutation = useCancelReservation()

  const filterFields = React.useMemo<FilterFieldDef[]>(
    () => [
      {
        id: 'status',
        label: 'الحالة',
        type: 'select',
        options: [
          { value: 'all', label: 'الكل' },
          ...Object.entries(RESERVATION_STATUS_MAP).map(([value, v]) => ({
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
      createDataColumn<ReservationDto>({
        accessorKey: 'reservation_number',
        header: 'الرقم',
        sortable: true
      }),
      createDataColumn<ReservationDto>({
        id: 'customer',
        header: 'العميل',
        cell: ({ row }) => customerName.get(row.customer_id) ?? row.customer_id.slice(0, 8)
      }),
      createDataColumn<ReservationDto>({
        id: 'window',
        header: 'الفترة',
        cell: ({ row }) =>
          `${new Date(row.rental_start_at).toLocaleDateString('ar-IQ')} → ${new Date(row.expected_return_at).toLocaleDateString('ar-IQ')}`
      }),
      createDataColumn<ReservationDto>({
        id: 'status',
        header: 'الحالة',
        cell: ({ row }) => {
          const mapped = mapStatus(String(row.status), RESERVATION_STATUS_MAP)
          return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
        }
      }),
      createDataColumn<ReservationDto>({
        id: 'items',
        header: 'الفساتين',
        cell: ({ row }) => String(row.items?.length ?? 0)
      })
    ],
    [customerName]
  )

  const actions = React.useMemo<DataRowAction<ReservationDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'reservation.view',
        onClick: (row) => void navigate(`/reservations/${row.id}`)
      },
      {
        id: 'edit',
        label: 'تعديل',
        icon: 'Pencil',
        permission: 'reservation.update',
        disabled: (row) => row.status !== 'DRAFT',
        onClick: (row) => void navigate(`/reservations/${row.id}/edit`)
      },
      {
        id: 'confirm',
        label: 'تأكيد',
        icon: 'Check',
        permission: 'reservation.update',
        disabled: (row) => row.status !== 'DRAFT',
        onClick: (row) => void confirmMutation.mutateAsync(row.id)
      },
      {
        id: 'cancel',
        label: 'إلغاء',
        icon: 'X',
        tone: 'danger',
        permission: 'reservation.cancel',
        disabled: (row) => row.status !== 'DRAFT' && row.status !== 'CONFIRMED',
        onClick: (row) => setCancelTarget(row)
      }
    ],
    [navigate, confirmMutation]
  )

  if (!canView) return <Navigate to="/forbidden" replace />

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1)

  return (
    <Page size="full" as="main">
      <PageHeader
        title="الحجوزات"
        description="مسودات وتأكيدات حجز الفساتين"
        actions={
          <PageActions>
            <PermissionGuard permission="reservation.create">
              <Button type="button" onClick={() => void navigate('/reservations/new')}>
                حجز جديد
              </Button>
            </PermissionGuard>
          </PageActions>
        }
        toolbar={
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <SearchBar
                value={customerQ}
                onValueChange={(v) => {
                  setCustomerQ(v)
                  setCustomerId(undefined)
                  setPagination((p) => ({ ...p, pageIndex: 0 }))
                }}
                placeholder="بحث عميل ثم اختيار…"
              />
              {customerId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomerId(undefined)
                    setCustomerQ('')
                  }}
                >
                  مسح فلتر العميل
                </Button>
              ) : null}
            </div>
            {!customerId && customerQ.trim().length >= 2 && (customers.data?.data.length ?? 0) > 0 ? (
              <ul className="max-h-40 overflow-auto rounded-md border border-border">
                {(customers.data?.data ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-start text-body hover:bg-brand-subtle"
                      onClick={() => {
                        setCustomerId(c.id)
                        setCustomerQ(c.full_name)
                        setPagination((p) => ({ ...p, pageIndex: 0 }))
                      }}
                    >
                      {c.full_name} · {c.customer_number}
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
        <ErrorState
          title="تعذر تحميل الحجوزات"
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
            empty={<EmptyState title="لا حجوزات" description="أنشئ حجزاً للبدء" />}
          />
        </>
      )}

      <ConfirmationDialog
        open={cancelTarget != null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="إلغاء الحجز؟"
        description={
          cancelTarget
            ? `هل تريد إلغاء «${cancelTarget.reservation_number}»؟`
            : null
        }
        confirmLabel="إلغاء الحجز"
        tone="danger"
        loading={cancelMutation.isPending}
        onConfirm={async () => {
          if (!cancelTarget) return
          await cancelMutation.mutateAsync(cancelTarget.id)
          setCancelTarget(null)
        }}
      />
    </Page>
  )
}
