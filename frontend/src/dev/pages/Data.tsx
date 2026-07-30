import * as React from 'react'
import { useAuthStore } from '@/stores/authStore'
import {
  Button,
  createDataColumn,
  DataTable,
  FilterBar,
  type FilterFieldDef,
  Grid,
  KPICard,
  mapStatus,
  SearchBar,
  Section,
  Stack,
  StatisticsCard,
  StatusBadge,
  type DataColumnFilter,
  type DataPaginationState,
  type DataRowSelectionState,
  type DataSortingState
} from '@/components/ui'

type DemoRow = {
  id: string
  name: string
  phone: string
  status: 'AVAILABLE' | 'RENTED' | 'PROCESSING'
  vip: boolean
  amount: number
}

const STATUS_MAP = {
  AVAILABLE: { tone: 'success' as const, label: 'متاح' },
  RENTED: { tone: 'info' as const, label: 'مؤجّر' },
  PROCESSING: { tone: 'warning' as const, label: 'معالجة' }
}

const ALL_ROWS: DemoRow[] = [
  { id: '1', name: 'فستان سهرة أ', phone: '7700000001', status: 'AVAILABLE', vip: true, amount: 150 },
  { id: '2', name: 'فستان سهرة ب', phone: '7700000002', status: 'RENTED', vip: false, amount: 200 },
  { id: '3', name: 'عباية', phone: '7700000003', status: 'PROCESSING', vip: false, amount: 90 },
  { id: '4', name: 'بدلة', phone: '7700000004', status: 'AVAILABLE', vip: true, amount: 120 },
  { id: '5', name: 'فستان زفاف', phone: '7700000005', status: 'RENTED', vip: true, amount: 400 },
  { id: '6', name: 'شاشة عرض', phone: '7700000006', status: 'AVAILABLE', vip: false, amount: 50 },
  { id: '7', name: 'إكسسوار', phone: '7700000007', status: 'PROCESSING', vip: false, amount: 30 },
  { id: '8', name: 'حقيبة', phone: '7700000008', status: 'AVAILABLE', vip: false, amount: 40 },
  { id: '9', name: 'حذاء', phone: '7700000009', status: 'RENTED', vip: true, amount: 70 },
  { id: '10', name: 'طقم كامل', phone: '7700000010', status: 'AVAILABLE', vip: true, amount: 500 },
  { id: '11', name: 'شالات', phone: '7700000011', status: 'PROCESSING', vip: false, amount: 25 },
  { id: '12', name: 'تاج', phone: '7700000012', status: 'AVAILABLE', vip: true, amount: 80 }
]

const filterFields: FilterFieldDef[] = [
  { id: 'status', label: 'الحالة', type: 'select', options: [
    { value: 'AVAILABLE', label: 'متاح' },
    { value: 'RENTED', label: 'مؤجّر' },
    { value: 'PROCESSING', label: 'معالجة' }
  ]},
  { id: 'vip', label: 'VIP', type: 'boolean', placeholder: 'عملاء مميزون فقط' }
]

const columns = [
  createDataColumn<DemoRow>({
    accessorKey: 'name',
    header: 'الاسم',
    sortable: true,
    resizable: true,
    filterable: true
  }),
  createDataColumn<DemoRow>({
    accessorKey: 'phone',
    header: 'الهاتف',
    sortable: true
  }),
  createDataColumn<DemoRow>({
    id: 'status',
    accessorKey: 'status',
    header: 'الحالة',
    sortable: true,
    cell: ({ row }) => {
      const mapped = mapStatus(row.status, STATUS_MAP)
      return <StatusBadge tone={mapped.tone}>{mapped.label}</StatusBadge>
    }
  }),
  createDataColumn<DemoRow>({
    accessorKey: 'amount',
    header: 'المبلغ',
    sortable: true,
    align: 'end',
    cell: ({ getValue }) => `${getValue()} ألف`
  })
]

export default function DataPage(): React.ReactElement {
  React.useEffect(() => {
    useAuthStore.setState({
      ready: true,
      session: {
        authenticated: true,
        permissions: ['demo.view', 'demo.edit', 'demo.delete'],
        user: undefined
      }
    })
  }, [])

  const [query, setQuery] = React.useState('')
  const [filters, setFilters] = React.useState<DataColumnFilter[]>([])
  const [sorting, setSorting] = React.useState<DataSortingState>([])
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 5
  })
  const [selection, setSelection] = React.useState<DataRowSelectionState>({})
  const [loadingMode, setLoadingMode] = React.useState<'off' | 'busy' | 'skeleton'>('off')

  const filtered = React.useMemo(() => {
    let rows = ALL_ROWS
    if (query.trim()) {
      const q = query.trim()
      rows = rows.filter((r) => r.name.includes(q) || r.phone.includes(q))
    }
    for (const f of filters) {
      if (f.id === 'status' && typeof f.value === 'string') {
        rows = rows.filter((r) => r.status === f.value)
      }
      if (f.id === 'vip' && f.value === true) {
        rows = rows.filter((r) => r.vip)
      }
    }
    return rows
  }, [filters, query])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8" dir="rtl">
      <header>
        <h2 className="text-h2 text-foreground">البيانات</h2>
        <p className="text-body text-muted-foreground">
          DataTable · SearchBar · FilterBar · Pagination · KPI · Status — حالة مضبوطة من الأب.
          الافتراضية جاهزة؛ التمرير الافتراضي (virtualization) مؤجّل مع تحذير DEV عند التفعيل.
        </p>
      </header>

      <Section title="مؤشرات">
        <Grid cols={3} gap={4}>
          <KPICard
            title="الإيجارات النشطة"
            value="128"
            subtitle="هذا الشهر"
            icon="Sparkles"
            trend="up"
            trendLabel="+8%"
          />
          <KPICard title="المبيعات اليوم" value="14" subtitle="اليوم" icon="ShoppingBag" trend="flat" trendLabel="مستقر" />
          <KPICard title="قيد المعالجة" value="6" subtitle="طابور" icon="Shirt" trend="down" trendLabel="-2" />
        </Grid>
        <div className="mt-4">
          <StatisticsCard
            title="ملخص الأسبوع"
            description="قيم تلخيصية — chartSlot للمستقبل"
            values={[
              { label: 'حجوزات', value: '42' },
              { label: 'مرتجعات', value: '11' },
              { label: 'فحوصات', value: '9' }
            ]}
            comparison={{ label: 'مقابل الأسبوع السابق', value: '+6%', delta: 'تحسن' }}
            chartSlot={<p className="text-caption text-muted-foreground">مكان الرسم البياني المصغّر (لاحقاً)</p>}
          />
        </div>
      </Section>

      <Section title="جدول البيانات" description="فرز · تصفية · تحديد متعدد (Shift) · إجراءات بصلاحيات">
        <Stack gap={3}>
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar
              value={query}
              onValueChange={setQuery}
              shortcutHint="Ctrl+K"
              onShortcut={() => undefined}
              className="max-w-sm"
            />
            <Button size="sm" variant="outline" onClick={() => setLoadingMode((m) => (m === 'busy' ? 'off' : 'busy'))}>
              تبديل التحميل
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLoadingMode((m) => (m === 'skeleton' ? 'off' : 'skeleton'))}
            >
              هيكل عظمي
            </Button>
          </div>
          <FilterBar fields={filterFields} value={filters} onChange={setFilters} />
          <DataTable
            columns={columns}
            data={filtered}
            getRowId={(r) => r.id}
            sorting={sorting}
            onSortingChange={setSorting}
            pagination={pagination}
            onPaginationChange={setPagination}
            globalFilter={query}
            columnFilters={filters}
            enableRowSelection
            rowSelection={selection}
            onRowSelectionChange={setSelection}
            loading={loadingMode === 'busy' ? true : loadingMode === 'skeleton' ? 'skeleton' : false}
            empty="لا توجد صفوف مطابقة"
            actions={[
              { id: 'view', label: 'عرض', icon: 'Eye', permission: 'demo.view', onClick: () => undefined },
              { id: 'edit', label: 'تعديل', icon: 'Pencil', permission: 'demo.edit', onClick: () => undefined },
              {
                id: 'delete',
                label: 'حذف',
                icon: 'Trash2',
                tone: 'danger',
                permission: 'demo.delete',
                onClick: () => undefined
              }
            ]}
          />
          <p className="text-caption text-muted-foreground">
            محدد: {Object.keys(selection).filter((k) => selection[k]).length} · نتائج: {filtered.length}
          </p>
        </Stack>
      </Section>
    </div>
  )
}
