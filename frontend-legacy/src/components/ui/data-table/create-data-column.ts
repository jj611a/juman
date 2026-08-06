import type { ColumnDef } from '@tanstack/react-table'
import type { DataCellContext, DataColumnDef } from './types'

/**
 * Creates a typed Juman column definition.
 * Features must use this API — never import TanStack ColumnDef.
 */
export function createDataColumn<TData>(def: DataColumnDef<TData>): DataColumnDef<TData> {
  if (!def.id && !def.accessorKey && !def.accessorFn) {
    throw new Error('createDataColumn: provide id, accessorKey, or accessorFn')
  }
  return def
}

/** Internal: map Juman defs → TanStack. Not exported from the public barrel. */
export function toTanStackColumns<TData>(
  columns: DataColumnDef<TData>[]
): ColumnDef<TData, unknown>[] {
  return columns.map((col) => {
    const id = col.id ?? (typeof col.accessorKey === 'string' ? col.accessorKey : undefined)
    if (!id) {
      throw new Error('createDataColumn: column id could not be resolved')
    }

    const alignClass =
      col.align === 'center' ? 'text-center' : col.align === 'end' ? 'text-end' : 'text-start'

    const mapped = {
      id,
      enableSorting: col.sortable ?? false,
      enableColumnFilter: col.filterable ?? false,
      enableResizing: col.resizable ?? true,
      enableHiding: col.hideable ?? true,
      size: typeof col.width === 'number' ? col.width : undefined,
      minSize: col.minWidth,
      maxSize: col.maxWidth,
      meta: {
        ...col.meta,
        alignClass,
        pinnable: col.pinnable ?? false,
        searchable: col.searchable ?? false,
        exportable: col.exportable ?? false,
        jumanHeader: col.header,
        jumanFooter: col.footer,
        jumanWidth: col.width
      }
    } as ColumnDef<TData, unknown>

    if (col.accessorKey) {
      ;(mapped as { accessorKey?: string }).accessorKey = col.accessorKey as string
    } else if (col.accessorFn) {
      ;(mapped as { accessorFn?: (row: TData) => unknown }).accessorFn = col.accessorFn
    }

    if (col.cell) {
      const render = col.cell
      mapped.cell = (info) => {
        const ctx: DataCellContext<TData> = {
          row: info.row.original,
          rowIndex: info.row.index,
          columnId: info.column.id,
          getValue: () => info.getValue()
        }
        return render(ctx)
      }
    }

    if (col.header !== undefined) {
      const header = col.header
      mapped.header =
        typeof header === 'function' ? () => header({ columnId: id }) : () => header
    }

    if (col.footer !== undefined) {
      const footer = col.footer
      mapped.footer =
        typeof footer === 'function' ? () => footer({ columnId: id }) : () => footer
    }

    return mapped
  })
}
