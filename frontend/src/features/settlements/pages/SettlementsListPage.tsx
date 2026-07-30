import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
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
  StatusBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  TextInput,
  mapStatus,
  type DataColumnFilter,
  type DataPaginationState,
  type DataRowAction,
  type DataSortingState,
  type FilterFieldDef
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import type { SettlementDto } from '@/services/domainTypes'
import { useSettlementsList } from '../hooks'
import { SETTLEMENT_STATUS_MAP } from '../statusMap'

const OUTSTANDING_FETCH_LIMIT = 200

function sortSettlements(rows: SettlementDto[], sorting: DataSortingState): SettlementDto[] {
  const col = sorting[0]?.id ?? 'created_at'
  const desc = sorting[0]?.desc ?? true
  return [...rows].sort((a, b) => {
    let av: string | number = ''
    let bv: string | number = ''
    if (col === 'settlement_number') {
      av = a.settlement_number
      bv = b.settlement_number
    } else if (col === 'status') {
      av = a.status
      bv = b.status
    } else if (col === 'settled_at') {
      av = a.settled_at ?? ''
      bv = b.settled_at ?? ''
    } else {
      av = a.created_at
      bv = b.created_at
    }
    if (av < bv) return desc ? 1 : -1
    if (av > bv) return desc ? -1 : 1
    return 0
  })
}

export default function SettlementsListPage(): React.ReactElement {
  const canView = usePermission('rental.settlement.view')
  const navigate = useNavigate()
  const [viewPreset, setViewPreset] = React.useState<'all' | 'outstanding'>('all')
  const [rentalId, setRentalId] = React.useState('')
  const [filters, setFilters] = React.useState<DataColumnFilter[]>([])
  const [sorting, setSorting] = React.useState<DataSortingState>([
    { id: 'created_at', desc: true }
  ])
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })

  const statusFilter = filters.find((f) => f.id === 'status')?.value
  const isOutstanding =
    viewPreset === 'outstanding' ||
    (typeof statusFilter === 'string' && statusFilter === 'outstanding')

  const baseParams = React.useMemo(
    () => ({
      rental_id: rentalId.trim() || undefined,
      sort_by: (sorting[0]?.id ?? 'created_at') as
        | 'settlement_number'
        | 'status'
        | 'created_at'
        | 'settled_at',
      sort_dir: (sorting[0]?.desc ? 'desc' : 'asc') as 'asc' | 'desc'
    }),
    [rentalId, sorting]
  )

  const openQuery = useSettlementsList(
    { ...baseParams, status: 'OPEN', offset: 0, limit: OUTSTANDING_FETCH_LIMIT },
    { enabled: isOutstanding }
  )
  const partialQuery = useSettlementsList(
    {
      ...baseParams,
      status: 'PARTIALLY_PAID',
      offset: 0,
      limit: OUTSTANDING_FETCH_LIMIT
    },
    { enabled: isOutstanding }
  )

  const normalParams = React.useMemo(
    () => ({
      ...baseParams,
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize,
      status:
        typeof statusFilter === 'string' && statusFilter !== 'all' && statusFilter !== 'outstanding'
          ? statusFilter
          : undefined
    }),
    [baseParams, pagination, statusFilter]
  )

  const normalQuery = useSettlementsList(normalParams, { enabled: !isOutstanding })

  const mergedOutstanding = React.useMemo(() => {
    if (!isOutstanding) return []
    const byId = new Map<string, SettlementDto>()
    for (const row of openQuery.data?.data ?? []) byId.set(row.id, row)
    for (const row of partialQuery.data?.data ?? []) byId.set(row.id, row)
    return sortSettlements([...byId.values()], sorting)
  }, [isOutstanding, openQuery.data, partialQuery.data, sorting])

  const rows = React.useMemo(() => {
    if (isOutstanding) {
      const start = pagination.pageIndex * pagination.pageSize
      return mergedOutstanding.slice(start, start + pagination.pageSize)
    }
    return normalQuery.data?.data ?? []
  }, [isOutstanding, mergedOutstanding, normalQuery.data, pagination])

  const total = isOutstanding ? mergedOutstanding.length : (normalQuery.data?.meta.total ?? 0)

  const listLoading = isOutstanding
    ? openQuery.isLoading ||
      partialQuery.isLoading ||
      openQuery.isFetching ||
      partialQuery.isFetching
    : normalQuery.isLoading || normalQuery.isFetching

  const listError = isOutstanding ? openQuery.isError || partialQuery.isError : normalQuery.isError

  const refetch = (): void => {
    if (isOutstanding) {
      void openQuery.refetch()
      void partialQuery.refetch()
    } else {
      void normalQuery.refetch()
    }
  }

  const filterFields = React.useMemo<FilterFieldDef[]>(
    () => [
      {
        id: 'status',
        label: 'الحالة',
        type: 'select',
        options: [
          { value: 'all', label: 'الكل' },
          { value: 'outstanding', label: 'المبالغ المستحقة' },
          ...Object.entries(SETTLEMENT_STATUS_MAP).map(([value, v]) => ({
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
      createDataColumn<SettlementDto>({
        accessorKey: 'settlement_number',
        header: 'الرقم',
        sortable: true
      }),
      createDataColumn<SettlementDto>({
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
      createDataColumn<SettlementDto>({
        id: 'status',
        header: 'الحالة',
        sortable: true,
        cell: ({ row }) => {
          const mapped = mapStatus(String(row.status), SETTLEMENT_STATUS_MAP)
          return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
        }
      }),
      createDataColumn<SettlementDto>({
        id: 'total_due',
        header: 'المستحق',
        cell: ({ row }) => <MoneyDisplay value={row.total_due} />
      }),
      createDataColumn<SettlementDto>({
        id: 'total_paid',
        header: 'المدفوع',
        cell: ({ row }) => <MoneyDisplay value={row.total_paid} />
      }),
      createDataColumn<SettlementDto>({
        id: 'remaining_balance',
        header: 'المتبقي',
        cell: ({ row }) => <MoneyDisplay value={row.remaining_balance} />
      }),
      createDataColumn<SettlementDto>({
        id: 'created_at',
        header: 'الإنشاء',
        sortable: true,
        cell: ({ row }) => new Date(row.created_at).toLocaleString('ar-IQ')
      })
    ],
    [navigate]
  )

  const actions = React.useMemo<DataRowAction<SettlementDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'rental.settlement.view',
        onClick: (row) => void navigate(`/settlements/${row.id}`)
      }
    ],
    [navigate]
  )

  if (!canView) return <Navigate to="/forbidden" replace />

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1)

  return (
    <Page size="full" as="main">
      <PageHeader
        title="تسويات التأجير"
        description="التسوية المالية بعد الإرجاع والفحص"
        actions={
          <PageActions>
            <PermissionGuard permission="rental.settlement.create">
              <Button type="button" onClick={() => void navigate('/settlements/new')}>
                تسوية جديدة
              </Button>
            </PermissionGuard>
          </PageActions>
        }
        toolbar={
          <div className="flex w-full flex-col gap-3">
            <Tabs
              value={viewPreset}
              onValueChange={(v) => {
                const preset = v as 'all' | 'outstanding'
                setViewPreset(preset)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
                if (preset === 'outstanding') {
                  setFilters([{ id: 'status', value: 'outstanding' }])
                } else {
                  setFilters((prev) =>
                    prev.filter((f) => f.id !== 'status' || f.value !== 'outstanding')
                  )
                }
              }}
            >
              <TabsList>
                <TabsTrigger value="all">الكل</TabsTrigger>
                <TabsTrigger value="outstanding">المبالغ المستحقة</TabsTrigger>
              </TabsList>
            </Tabs>
            <TextInput
              value={rentalId}
              onChange={(e) => {
                setRentalId(e.target.value)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
              placeholder="معرّف التأجير (اختياري)"
            />
            <FilterBar
              fields={filterFields}
              value={filters}
              onChange={(next) => {
                setFilters(next)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
                const st = next.find((f) => f.id === 'status')?.value
                if (st === 'outstanding') setViewPreset('outstanding')
                else if (viewPreset === 'outstanding' && st !== 'outstanding') setViewPreset('all')
              }}
            />
          </div>
        }
      />
      {listError ? (
        <ErrorState title="تعذّر تحميل التسويات" onRetry={refetch} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            manual
            loading={listLoading}
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
                title="لا تسويات"
                description="أنشئ تسوية لتأجير بانتظار الإرجاع"
              />
            }
          />
        </>
      )}
    </Page>
  )
}
