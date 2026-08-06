import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnSizingState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  type Updater
} from '@tanstack/react-table'
import { PermissionGate } from '@/app/PermissionGate'
import { Icon, type IconName } from '@/components/icons'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import { Pagination } from '@/components/ui/pagination'
import { toTanStackColumns } from './create-data-column'
import { applyRangeSelection } from './selection'
import type {
  DataColumnDef,
  DataColumnFilter,
  DataColumnOrderState,
  DataColumnSizingState,
  DataColumnVisibilityState,
  DataPaginationState,
  DataRowAction,
  DataRowSelectionState,
  DataSortingState,
  DataTableLoading,
  DataVirtualizationConfig
} from './types'
import { cn } from '@/utils/cn'

function applyUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater
}

export interface DataTableProps<TData> {
  columns: DataColumnDef<TData>[]
  data: TData[]
  getRowId?: (row: TData, index: number) => string

  sorting?: DataSortingState
  onSortingChange?: (next: DataSortingState) => void

  pagination?: DataPaginationState
  onPaginationChange?: (next: DataPaginationState) => void
  pageCount?: number
  totalItems?: number

  globalFilter?: string
  onGlobalFilterChange?: (next: string) => void

  columnFilters?: DataColumnFilter[]
  onColumnFiltersChange?: (next: DataColumnFilter[]) => void

  rowSelection?: DataRowSelectionState
  onRowSelectionChange?: (next: DataRowSelectionState) => void
  enableRowSelection?: boolean
  enableMultiRowSelection?: boolean

  columnVisibility?: DataColumnVisibilityState
  onColumnVisibilityChange?: (next: DataColumnVisibilityState) => void

  columnOrder?: DataColumnOrderState
  onColumnOrderChange?: (next: DataColumnOrderState) => void

  columnSizing?: DataColumnSizingState
  onColumnSizingChange?: (next: DataColumnSizingState) => void

  /** When true, parent supplies sliced data / pageCount (server-driven). */
  manual?: boolean

  loading?: DataTableLoading
  empty?: React.ReactNode
  error?: React.ReactNode

  actions?: DataRowAction<TData>[]
  showColumnVisibilityMenu?: boolean
  stickyHeader?: boolean

  /** Architecture-ready: not implemented in 2.5. */
  virtualization?: DataVirtualizationConfig

  className?: string
}

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  sorting = [],
  onSortingChange,
  pagination = { pageIndex: 0, pageSize: 10 },
  onPaginationChange,
  pageCount,
  totalItems,
  globalFilter = '',
  onGlobalFilterChange,
  columnFilters = [],
  onColumnFiltersChange,
  rowSelection = {},
  onRowSelectionChange,
  enableRowSelection = false,
  enableMultiRowSelection = true,
  columnVisibility = {},
  onColumnVisibilityChange,
  columnOrder,
  onColumnOrderChange,
  columnSizing = {},
  onColumnSizingChange,
  manual = false,
  loading = false,
  empty,
  error,
  actions,
  showColumnVisibilityMenu = true,
  stickyHeader = true,
  virtualization,
  className
}: DataTableProps<TData>): React.ReactElement {
  const virtWarnedRef = React.useRef(false)
  React.useEffect(() => {
    if (!virtualization?.enabled || virtWarnedRef.current) return
    if (import.meta.env.DEV) {
      virtWarnedRef.current = true
      console.warn(
        '[DataTable] virtualization.enabled is architecture-ready only; no runtime virtualizer is shipped yet.'
      )
    }
  }, [virtualization?.enabled])
  const anchorRef = React.useRef<string | null>(null)

  const tanColumns = React.useMemo(() => {
    const base = toTanStackColumns(columns)
    const cols = [...base]

    if (enableRowSelection) {
      cols.unshift({
        id: '__select',
        size: 40,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="تحديد الكل"
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
          />
        ),
        cell: ({ row, table }) => {
          const id = row.id
          return (
            <Checkbox
              aria-label="تحديد الصف"
              checked={row.getIsSelected()}
              onCheckedChange={() => {
                /* handled in onClick for shift */
              }}
              onClick={(e) => {
                e.preventDefault()
                const ids = table.getRowModel().rows.map((r) => r.id)
                const result = applyRangeSelection({
                  rowIds: ids,
                  anchorId: anchorRef.current,
                  targetId: id,
                  shiftKey: e.shiftKey,
                  previous: rowSelection
                })
                anchorRef.current = result.anchorId
                onRowSelectionChange?.(result.selection)
              }}
            />
          )
        }
      })
    }

    if (actions && actions.length > 0) {
      cols.push({
        id: '__actions',
        size: 56,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        header: () => <span className="sr-only">إجراءات</span>,
        cell: ({ row }) => (
          <RowActionsMenu row={row.original} actions={actions} />
        )
      })
    }

    return cols
  }, [actions, columns, enableRowSelection, onRowSelectionChange, rowSelection])

  const table = useReactTable({
    data,
    columns: tanColumns,
    getRowId: getRowId
      ? (row, index) => getRowId(row, index)
      : undefined,
    state: {
      sorting: sorting as SortingState,
      pagination: pagination as PaginationState,
      globalFilter,
      columnFilters: columnFilters as ColumnFiltersState,
      rowSelection: rowSelection as RowSelectionState,
      columnVisibility: columnVisibility as VisibilityState,
      columnOrder: (columnOrder as ColumnOrderState) ?? [],
      columnSizing: columnSizing as ColumnSizingState
    },
    enableRowSelection,
    enableMultiRowSelection,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    manualPagination: manual,
    manualSorting: manual,
    manualFiltering: manual,
    pageCount: manual ? pageCount : undefined,
    onSortingChange: (updater) => {
      const next = applyUpdater(updater, sorting as SortingState) as DataSortingState
      onSortingChange?.(next)
    },
    onPaginationChange: (updater) => {
      const next = applyUpdater(updater, pagination as PaginationState) as DataPaginationState
      onPaginationChange?.(next)
    },
    onGlobalFilterChange: (updater) => {
      const next = applyUpdater(updater, globalFilter)
      onGlobalFilterChange?.(String(next ?? ''))
    },
    onColumnFiltersChange: (updater) => {
      const next = applyUpdater(updater, columnFilters as ColumnFiltersState) as DataColumnFilter[]
      onColumnFiltersChange?.(next)
    },
    onRowSelectionChange: (updater) => {
      const next = applyUpdater(updater, rowSelection as RowSelectionState) as DataRowSelectionState
      onRowSelectionChange?.(next)
    },
    onColumnVisibilityChange: (updater) => {
      const next = applyUpdater(
        updater,
        columnVisibility as VisibilityState
      ) as DataColumnVisibilityState
      onColumnVisibilityChange?.(next)
    },
    onColumnOrderChange: (updater) => {
      const prev = (columnOrder ?? table.getAllLeafColumns().map((c) => c.id)) as ColumnOrderState
      const next = applyUpdater(updater, prev) as DataColumnOrderState
      onColumnOrderChange?.(next)
    },
    onColumnSizingChange: (updater) => {
      const next = applyUpdater(updater, columnSizing as ColumnSizingState) as DataColumnSizingState
      onColumnSizingChange?.(next)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manual ? undefined : getSortedRowModel(),
    getFilteredRowModel: manual ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manual ? undefined : getPaginationRowModel()
  })

  const rows = table.getRowModel().rows
  const isSkeleton = loading === 'skeleton'
  const isBusy = loading === true

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {showColumnVisibilityMenu ? (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton icon="Columns3" size="sm" variant="outline" aria-label="إظهار الأعمدة" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>الأعمدة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((c) => c.id !== '__select' && c.id !== '__actions' && c.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(v === true)}
                  >
                    {typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <div className="relative overflow-auto rounded-box border border-base-content/10 bg-base-300 shadow-sm">
        {isBusy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-base-100/60 backdrop-blur-[1px]">
            <span
              className="loading loading-spinner loading-lg text-primary"
              role="status"
              aria-label="جاري التحميل"
            />
          </div>
        ) : null}

        <table
          className="table table-md w-full caption-bottom text-caption"
          style={{ width: table.getCenterTotalSize() }}
        >
          <thead
            className={cn(
              'bg-base-200 text-base-content/55',
              stickyHeader && 'sticky top-0 z-[1] shadow-[0_1px_0_0_color-mix(in_oklab,var(--color-base-content)_12%,transparent)]'
            )}
          >
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-base-content/10">
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta as { alignClass?: string } | undefined
                  const canSort = header.column.getCanSort()
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'relative h-11 px-3 font-medium whitespace-nowrap',
                        meta?.alignClass,
                        canSort && 'cursor-pointer select-none hover:text-primary'
                      )}
                      style={{ width: header.getSize() }}
                      aria-sort={
                        header.column.getIsSorted() === 'asc'
                          ? 'ascending'
                          : header.column.getIsSorted() === 'desc'
                            ? 'descending'
                            : canSort
                              ? 'none'
                              : undefined
                      }
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      onKeyDown={
                        canSort
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                header.column.getToggleSortingHandler()?.(e)
                              }
                            }
                          : undefined
                      }
                      tabIndex={canSort ? 0 : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <Icon name="ArrowUp" size={12} />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <Icon name="ArrowDown" size={12} />
                        ) : null}
                      </div>
                      {header.column.getCanResize() ? (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            'absolute end-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary/40',
                            header.column.getIsResizing() && 'bg-primary'
                          )}
                        />
                      ) : null}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {error ? (
              <tr>
                <td colSpan={Math.max(1, table.getVisibleLeafColumns().length)} className="p-8 text-center">
                  {error}
                </td>
              </tr>
            ) : isSkeleton ? (
              Array.from({ length: pagination.pageSize }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-base-content/10">
                  {table.getVisibleLeafColumns().map((col) => (
                    <td key={col.id} className="px-3 py-3">
                      <div className="skeleton h-4 w-full animate-pulse rounded-md bg-base-200" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(1, table.getVisibleLeafColumns().length)}
                  className="p-8 text-center text-base-content/55"
                >
                  {empty ?? 'لا توجد بيانات'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className={cn(
                    'border-b border-base-content/10 transition-colors duration-[var(--duration-fast)] hover:bg-base-content/5',
                    row.getIsSelected() && 'bg-primary/10 shadow-[inset_-2px_0_0_0_var(--color-primary)]'
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { alignClass?: string } | undefined
                    return (
                      <td
                        key={cell.id}
                        className={cn('px-3 py-3 align-middle', meta?.alignClass)}
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {onPaginationChange ? (
        <Pagination
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          pageCount={
            manual
              ? pageCount
              : table.getPageCount()
          }
          totalItems={totalItems}
          disabled={isBusy}
        />
      ) : null}
    </div>
  )
}

function RowActionsMenu<TData>({
  row,
  actions
}: {
  row: TData
  actions: DataRowAction<TData>[]
}): React.ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton icon="MoreVertical" size="sm" variant="ghost" aria-label="إجراءات الصف" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {actions.map((action) => {
          const disabled =
            typeof action.disabled === 'function' ? action.disabled(row) : Boolean(action.disabled)
          const item = (
            <DropdownMenuItem
              key={action.id}
              disabled={disabled}
              tone={action.tone === 'danger' ? 'danger' : 'default'}
              onSelect={() => action.onClick(row)}
            >
              {action.icon ? (
                <Icon name={action.icon as IconName} size="sm" className="opacity-80" />
              ) : null}
              {action.label}
            </DropdownMenuItem>
          )
          if (action.permission) {
            return (
              <PermissionGate key={action.id} permission={action.permission}>
                {item}
              </PermissionGate>
            )
          }
          return item
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
