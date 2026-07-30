import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  EmptyState,
  Page,
  PageHeader,
  SearchBar,
  BusyIndicator
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { apiClient } from '@/services/apiClient'

export default function CalendarHomePage(): React.ReactElement {
  const canView = usePermission('calendar.view')
  const navigate = useNavigate()
  const [q, setQ] = React.useState('')
  const [debounced, setDebounced] = React.useState('')

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300)
    return () => window.clearTimeout(t)
  }, [q])

  const listQuery = useQuery({
    queryKey: ['inventory', 'list', { q: debounced, page: 1, page_size: 20 }],
    queryFn: () =>
      apiClient.dresses.list({
        page: 1,
        page_size: 20,
        q: debounced || undefined,
        is_active: true,
        sort_by: 'name_ar',
        sort_dir: 'asc'
      }),
    enabled: canView
  })

  if (!canView) return <Navigate to="/forbidden" replace />

  return (
    <Page size="lg" as="main">
      <PageHeader
        title="التقويم"
        description="اختر فستاناً لعرض جدول توفره — التقويم مرتبط بفستان واحد فقط."
      />
      <div className="mb-4 max-w-md">
        <SearchBar value={q} onValueChange={setQ} placeholder="بحث بالاسم أو الباركود…" />
      </div>
      {listQuery.isLoading ? (
        <BusyIndicator label="جاري التحميل…" />
      ) : (listQuery.data?.data.length ?? 0) === 0 ? (
        <EmptyState title="لا نتائج" description="جرّب بحثاً آخر أو أنشئ فساتين في المخزون" />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {(listQuery.data?.data ?? []).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="text-body text-foreground">{d.name_ar}</p>
                <p className="text-caption text-muted-foreground" dir="ltr">
                  {d.barcode}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => void navigate(`/calendar/${d.id}`)}>
                فتح التقويم
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
