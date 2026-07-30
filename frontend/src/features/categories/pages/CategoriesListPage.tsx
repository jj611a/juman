import * as React from 'react'
import { Navigate } from 'react-router'
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
  InlineMessage,
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
import type { CategoryDto } from '@/services/domainTypes'
import { CategoryDetails } from '../components/CategoryDetails'
import { CategoryForm } from '../components/CategoryForm'
import {
  useActivateCategory,
  useCategoriesList,
  useCreateCategory,
  useDeactivateCategory,
  useDeleteCategory,
  useUpdateCategory
} from '../hooks'
import type { CategoryFormValues } from '../schemas'
import { toCategoryPayload } from '../schemas'

type DrawerMode = 'create' | 'edit' | 'details' | null

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

export default function CategoriesListPage(): React.ReactElement {
  const canView = usePermission('categories.view')
  const [q, setQ] = React.useState('')
  const [filters, setFilters] = React.useState<DataColumnFilter[]>([])
  const [sorting, setSorting] = React.useState<DataSortingState>([
    { id: 'display_order', desc: false }
  ])
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })

  const [drawerMode, setDrawerMode] = React.useState<DrawerMode>(null)
  const [selected, setSelected] = React.useState<CategoryDto | null>(null)
  const [formDirty, setFormDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<CategoryDto | null>(null)

  const activeOnly =
    filters.find((f) => f.id === 'active_only')?.value === 'true' ? true : undefined

  const sortBy = sorting[0]?.id ?? 'display_order'
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

  const listQuery = useCategoriesList(listParams)
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory(selected?.id ?? '')
  const deleteMutation = useDeleteCategory()
  const activateMutation = useActivateCategory()
  const deactivateMutation = useDeactivateCategory()

  const columns = React.useMemo(
    () => [
      createDataColumn<CategoryDto>({
        accessorKey: 'name_ar',
        header: 'الاسم',
        sortable: true
      }),
      createDataColumn<CategoryDto>({
        accessorKey: 'name_en',
        header: 'الإنجليزية',
        cell: ({ row }) => row.name_en ?? '—'
      }),
      createDataColumn<CategoryDto>({
        accessorKey: 'display_order',
        header: 'الترتيب',
        sortable: true
      }),
      createDataColumn<CategoryDto>({
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

  const openCreate = (): void => {
    setSelected(null)
    setFormDirty(false)
    setDrawerMode('create')
  }

  const openDetails = (row: CategoryDto): void => {
    setSelected(row)
    setFormDirty(false)
    setDrawerMode('details')
  }

  const openEdit = (row: CategoryDto): void => {
    setSelected(row)
    setFormDirty(false)
    setDrawerMode('edit')
  }

  const requestCloseDrawer = (): void => {
    if (formDirty && (drawerMode === 'create' || drawerMode === 'edit')) {
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

  const actions = React.useMemo<DataRowAction<CategoryDto>[]>(
    () => [
      {
        id: 'view',
        label: 'عرض',
        icon: 'Eye',
        permission: 'categories.view',
        onClick: openDetails
      },
      {
        id: 'edit',
        label: 'تعديل',
        icon: 'Pencil',
        permission: 'categories.update',
        onClick: openEdit
      },
      {
        id: 'delete',
        label: 'حذف',
        icon: 'Trash2',
        tone: 'danger',
        permission: 'categories.delete',
        onClick: (row) => setDeleteTarget(row)
      }
    ],
    []
  )

  const handleCreate = async (values: CategoryFormValues): Promise<void> => {
    await createMutation.mutateAsync(toCategoryPayload(values))
    forceCloseDrawer()
  }

  const handleUpdate = async (values: CategoryFormValues): Promise<void> => {
    if (!selected) return
    await updateMutation.mutateAsync(toCategoryPayload(values))
    forceCloseDrawer()
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
        title="الفئات"
        description="إدارة فئات المنتجات والفساتين"
        actions={
          <PageActions>
            <PermissionGuard permission="categories.create">
              <Button type="button" onClick={openCreate}>
                فئة جديدة
              </Button>
            </PermissionGuard>
          </PageActions>
        }
        toolbar={
          <div className="flex w-full flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <SearchBar value={q} onValueChange={setQ} placeholder="بحث في الفئات…" />
            </div>
            <FilterBar fields={FILTER_FIELDS} value={filters} onChange={setFilters} />
          </div>
        }
      />

      {listQuery.isError ? (
        <ErrorState
          title="تعذر تحميل الفئات"
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
            empty={<EmptyState title="لا توجد فئات" description="أنشئ فئة للبدء" />}
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
            <DrawerTitle>
              {drawerMode === 'create'
                ? 'فئة جديدة'
                : drawerMode === 'edit'
                  ? 'تعديل الفئة'
                  : 'تفاصيل الفئة'}
            </DrawerTitle>
            <DrawerDescription>
              {drawerMode === 'details' ? 'عرض وإجراءات الفئة' : 'أدخل بيانات الفئة'}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            {drawerMode === 'create' ? (
              <CategoryForm
                submitting={createMutation.isPending}
                onSubmit={handleCreate}
                onCancel={requestCloseDrawer}
                onDirtyChange={setFormDirty}
              />
            ) : null}
            {drawerMode === 'edit' && selected ? (
              <CategoryForm
                key={selected.id}
                initial={selected}
                submitting={updateMutation.isPending}
                onSubmit={handleUpdate}
                onCancel={requestCloseDrawer}
                onDirtyChange={setFormDirty}
              />
            ) : null}
            {drawerMode === 'details' && selected ? (
              <CategoryDetails
                category={selected}
                busy={
                  activateMutation.isPending ||
                  deactivateMutation.isPending ||
                  deleteMutation.isPending
                }
                onEdit={() => openEdit(selected)}
                onActivate={() => void activateMutation.mutateAsync(selected.id).then((r) => setSelected(r.data))}
                onDeactivate={() =>
                  void deactivateMutation.mutateAsync(selected.id).then((r) => setSelected(r.data))
                }
                onDelete={() => setDeleteTarget(selected)}
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
        title="حذف الفئة"
        description={
          deleteTarget ? (
            <span>
              هل تريد حذف «{deleteTarget.name_ar}»؟{' '}
              {deleteMutation.isError ? (
                <InlineMessage variant="error" className="mt-2">
                  {(deleteMutation.error as { message?: string })?.message ??
                    'تعذر الحذف — قد تكون الفئة مستخدمة'}
                </InlineMessage>
              ) : (
                'لا يمكن التراجع عن هذا الإجراء إذا كانت الفئة غير مستخدمة.'
              )}
            </span>
          ) : null
        }
        confirmLabel="حذف"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteMutation.mutateAsync(deleteTarget.id)
            setDeleteTarget(null)
            forceCloseDrawer()
          } catch {
            /* toast + InlineMessage via mutation */
          }
        }}
      />
    </Page>
  )
}
