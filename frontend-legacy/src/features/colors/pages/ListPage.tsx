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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Page,
  PageActions,
  PageHeader,
  PermissionGuard,
  SearchBar,
  StatusBadge,
  TextInput,
  type DataPaginationState,
  type DataRowAction
} from '@/components/ui'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { usePermission } from '@/hooks/usePermission'
import type { ColorDto } from '@/services/domainTypes'
import { useColorsList, useCreateColor, useDeleteColor, useUpdateColor } from '../hooks'

type DrawerMode = 'create' | 'edit' | null

const colorSchema = z.object({
  name_ar: z.string().trim().min(1, 'الاسم مطلوب').max(200),
  hex_code: z
    .string()
    .trim()
    .refine((v) => !v || /^#[0-9A-Fa-f]{6}$/.test(v), 'صيغة اللون #RRGGBB')
})
type ColorFormValues = z.infer<typeof colorSchema>

function ColorForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
  onDirtyChange
}: {
  initial?: ColorDto | null
  submitting?: boolean
  onSubmit: (values: ColorFormValues) => void | Promise<void>
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
}): React.ReactElement {
  const form = useForm<ColorFormValues>({
    resolver: zodResolver(colorSchema),
    defaultValues: {
      name_ar: initial?.name_ar ?? '',
      hex_code: initial?.hex_code ?? ''
    }
  })
  const dirty = form.formState.isDirty
  React.useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(async (values) => {
          await onSubmit(values)
        })}
        noValidate
      >
        <FormField
          control={form.control}
          name="name_ar"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الاسم *</FormLabel>
              <FormControl>
                <TextInput {...field} autoFocus aria-required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="hex_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>رمز اللون (#RRGGBB)</FormLabel>
              <FormControl>
                <TextInput {...field} placeholder="#AABBCC" dir="ltr" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            إلغاء
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

export default function ColorsListPage(): React.ReactElement {
  const canView = usePermission('inventory.view')
  const [q, setQ] = React.useState('')
  const [pagination, setPagination] = React.useState<DataPaginationState>({
    pageIndex: 0,
    pageSize: 20
  })
  const [drawerMode, setDrawerMode] = React.useState<DrawerMode>(null)
  const [selected, setSelected] = React.useState<ColorDto | null>(null)
  const [formDirty, setFormDirty] = React.useState(false)
  const [discardOpen, setDiscardOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<ColorDto | null>(null)

  const listParams = React.useMemo(
    () => ({
      q: q || undefined,
      offset: pagination.pageIndex * pagination.pageSize,
      limit: pagination.pageSize
    }),
    [q, pagination]
  )

  const listQuery = useColorsList(listParams)
  const createMutation = useCreateColor()
  const updateMutation = useUpdateColor(selected?.id ?? '')
  const deleteMutation = useDeleteColor()

  const columns = React.useMemo(
    () => [
      createDataColumn<ColorDto>({
        accessorKey: 'name_ar',
        header: 'الاسم'
      }),
      createDataColumn<ColorDto>({
        accessorKey: 'hex_code',
        header: 'الرمز',
        cell: ({ row }) => row.hex_code ?? '—'
      }),
      createDataColumn<ColorDto>({
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

  const openEdit = (row: ColorDto): void => {
    setSelected(row)
    setFormDirty(false)
    setDrawerMode('edit')
  }

  const requestCloseDrawer = (): void => {
    if (formDirty) {
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

  const actions = React.useMemo<DataRowAction<ColorDto>[]>(
    () => [
      {
        id: 'edit',
        label: 'تعديل',
        icon: 'Pencil',
        permission: 'inventory.update',
        onClick: openEdit
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
    []
  )

  if (!canView) {
    return <Navigate to="/forbidden" replace />
  }

  const rows = listQuery.data?.data ?? []
  const total = listQuery.data?.meta.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pagination.pageSize)))

  return (
    <Page size="full" as="main">
      <PageHeader
        title="الألوان"
        description="إدارة ألوان المنتجات"
        actions={
          <PageActions>
            <PermissionGuard permission="inventory.create">
              <Button type="button" onClick={openCreate}>
                لون جديد
              </Button>
            </PermissionGuard>
          </PageActions>
        }
        toolbar={
          <div className="min-w-[16rem] flex-1">
            <SearchBar value={q} onValueChange={setQ} placeholder="بحث في الألوان…" />
          </div>
        }
      />

      {listQuery.isError ? (
        <ErrorState
          title="تعذر تحميل الألوان"
          message="تحقق من الاتصال ثم أعد المحاولة"
          onRetry={() => void listQuery.refetch()}
        />
      ) : (
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
          empty={<EmptyState title="لا توجد ألوان" description="أنشئ لوناً للبدء" />}
        />
      )}

      <Drawer
        open={drawerMode != null}
        onOpenChange={(open) => {
          if (!open) requestCloseDrawer()
        }}
      >
        <DrawerContent side="right" size="md">
          <DrawerHeader>
            <DrawerTitle>{drawerMode === 'create' ? 'لون جديد' : 'تعديل اللون'}</DrawerTitle>
            <DrawerDescription>أدخل بيانات اللون</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            {drawerMode === 'create' ? (
              <ColorForm
                submitting={createMutation.isPending}
                onSubmit={async (values) => {
                  await createMutation.mutateAsync({
                    name_ar: values.name_ar,
                    hex_code: values.hex_code.trim() || null
                  })
                  forceCloseDrawer()
                }}
                onCancel={requestCloseDrawer}
                onDirtyChange={setFormDirty}
              />
            ) : null}
            {drawerMode === 'edit' && selected ? (
              <ColorForm
                key={selected.id}
                initial={selected}
                submitting={updateMutation.isPending}
                onSubmit={async (values) => {
                  await updateMutation.mutateAsync({
                    name_ar: values.name_ar,
                    hex_code: values.hex_code.trim() || null
                  })
                  forceCloseDrawer()
                }}
                onCancel={requestCloseDrawer}
                onDirtyChange={setFormDirty}
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
        title="حذف اللون"
        description={deleteTarget ? `هل تريد حذف «${deleteTarget.name_ar}»؟` : null}
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
            /* toast via mutation */
          }
        }}
      />
    </Page>
  )
}
