import * as React from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import {
  AuditTimeline,
  Button,
  createDataColumn,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  Page,
  PageActions,
  PageHeader,
  Pagination,
  SearchBar,
  Tabs,
  TabsList,
  TabsTrigger,
  type DataColumnFilter,
  type DataPaginationState,
  type DataRowAction,
  type FilterFieldDef
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import type { AuditLogDto } from '@/services/domainTypes'
import { useAuditLogsList } from '../hooks'

const FILTER_FIELDS: FilterFieldDef[] = [
  { id: 'module', label: 'الوحدة', type: 'text', placeholder: 'inventory…' },
  { id: 'entity_type', label: 'نوع الكيان', type: 'text', placeholder: 'Dress…' },
  { id: 'entity_id', label: 'معرّف الكيان', type: 'text' },
  { id: 'action', label: 'الإجراء', type: 'text', placeholder: 'create…' },
  { id: 'username', label: 'المستخدم', type: 'text' },
  { id: 'created_from', label: 'من تاريخ', type: 'date' },
  { id: 'created_to', label: 'إلى تاريخ', type: 'date' }
]

function filterValue(filters: DataColumnFilter[], id: string): string | undefined {
  const raw = filters.find((f) => f.id === id)?.value
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  return raw.trim()
}

function toDateTimeParam(date: string | undefined, endOfDay: boolean): string | undefined {
  if (!date) return undefined
  return endOfDay ? `${date}T23:59:59` : `${date}T00:00:00`
}

export default function AuditListPage(): React.ReactElement {
  const canView = usePermission('audit.view')
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [filters, setFilters] = React.useState<DataColumnFilter[]>([])
  const [viewMode, setViewMode] = React.useState<'table' | 'timeline'>('table')
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })

  const listParams = React.useMemo(
    () => ({
      q: q.trim() || undefined,
      module: filterValue(filters, 'module'),
      entity_type: filterValue(filters, 'entity_type'),
      entity_id: filterValue(filters, 'entity_id'),
      action: filterValue(filters, 'action'),
      username: filterValue(filters, 'username'),
      created_from: toDateTimeParam(filterValue(filters, 'created_from'), false),
      created_to: toDateTimeParam(filterValue(filters, 'created_to'), true),
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize
    }),
    [q, filters, pagination]
  )

  const listQuery = useAuditLogsList(listParams, { enabled: canView })

  const columns = React.useMemo(
    () => [
      createDataColumn<AuditLogDto>({
        accessorKey: 'created_at',
        header: 'الوقت',
        cell: ({ row }) => new Date(row.created_at).toLocaleString('ar-IQ')
      }),
      createDataColumn<AuditLogDto>({
        accessorKey: 'module',
        header: 'الوحدة'
      }),
      createDataColumn<AuditLogDto>({
        accessorKey: 'entity_type',
        header: 'نوع الكيان'
      }),
      createDataColumn<AuditLogDto>({
        accessorKey: 'action',
        header: 'الإجراء'
      }),
      createDataColumn<AuditLogDto>({
        accessorKey: 'username',
        header: 'المستخدم',
        cell: ({ row }) => row.username ?? '—'
      }),
      createDataColumn<AuditLogDto>({
        accessorKey: 'message',
        header: 'الرسالة',
        cell: ({ row }) => row.message ?? '—'
      })
    ],
    []
  )

  const actions = React.useMemo<DataRowAction<AuditLogDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'audit.view',
        onClick: (row) => void navigate(`/audit/${row.id}`)
      }
    ],
    [navigate]
  )

  if (!canView) return <Navigate to="/forbidden" replace />

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pagination.pageSize)))

  return (
    <Page size="full" as="main">
      <PageHeader
        title="سجل التدقيق"
        description="أحداث النظام — قراءة فقط"
        actions={
          <PageActions>
            <Button type="button" variant="outline" disabled title="قريبًا">
              تصدير — قريبًا
            </Button>
          </PageActions>
        }
        toolbar={
          <div className="flex w-full flex-col gap-3">
            <SearchBar value={q} onValueChange={setQ} placeholder="بحث في السجل…" />
            <FilterBar fields={FILTER_FIELDS} value={filters} onChange={setFilters} />
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as 'table' | 'timeline')}
              className="w-fit"
            >
              <TabsList>
                <TabsTrigger value="table">جدول</TabsTrigger>
                <TabsTrigger value="timeline">خط زمني</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
      />

      {listQuery.isError ? (
        <ErrorState title="تعذر تحميل السجل" onRetry={() => void listQuery.refetch()} />
      ) : viewMode === 'timeline' ? (
        <div className="space-y-4">
          {listQuery.isLoading ? (
            <p className="text-caption text-muted-foreground">جاري التحميل…</p>
          ) : rows.length === 0 ? (
            <EmptyState title="لا أحداث" />
          ) : (
            <>
              <AuditTimeline
                items={rows.map((row) => ({
                  id: row.id,
                  at: row.created_at,
                  actor: row.username ?? undefined,
                  action: (
                    <Link to={`/audit/${row.id}`} className="text-brand hover:underline">
                      {row.action}
                    </Link>
                  ),
                  detail: row.message ?? `${row.module} · ${row.entity_type}`
                }))}
              />
              <Pagination
                pagination={pagination}
                onPaginationChange={setPagination}
                pageCount={pageCount}
                totalItems={total}
              />
            </>
          )}
        </div>
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
            empty={<EmptyState title="لا أحداث" />}
          />
        </>
      )}
    </Page>
  )
}
