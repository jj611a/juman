import type * as React from 'react'

export type DataAlign = 'start' | 'center' | 'end'

export type DataStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface DataCellContext<TData> {
  /** Original row object. */
  row: TData
  rowIndex: number
  columnId: string
  getValue: () => unknown
}

export interface DataColumnDef<TData> {
  id?: string
  accessorKey?: (keyof TData & string) | string
  accessorFn?: (row: TData) => unknown
  header?: React.ReactNode | ((ctx: { columnId: string }) => React.ReactNode)
  cell?: (ctx: DataCellContext<TData>) => React.ReactNode
  /** Reserved — DataTable does not render footers yet. */
  footer?: React.ReactNode | ((ctx: { columnId: string }) => React.ReactNode)
  width?: number | string
  minWidth?: number
  maxWidth?: number
  sortable?: boolean
  filterable?: boolean
  resizable?: boolean
  hideable?: boolean
  /** Reserved flag for future column pinning UI. */
  pinnable?: boolean
  /** Reserved flag for future per-column search tooling. */
  searchable?: boolean
  /** Reserved flag for future export tooling. */
  exportable?: boolean
  align?: DataAlign
  meta?: Record<string, unknown>
}

export type DataSortingState = Array<{ id: string; desc: boolean }>

export type DataPaginationState = {
  pageIndex: number
  pageSize: number
}

/**
 * Serializable filter payload for client + server modes.
 * Dates must be ISO calendar strings (`YYYY-MM-DD`), never `Date` objects.
 */
export type DataFilterValue = string | number | boolean | string[]

export type DataColumnFilter = {
  id: string
  value: DataFilterValue
}

export type DataRowSelectionState = Record<string, boolean>

export type DataColumnVisibilityState = Record<string, boolean>

export type DataColumnOrderState = string[]

export type DataColumnSizingState = Record<string, number>

export type DataTableLoading = boolean | 'skeleton'

export type DataVirtualizationConfig = {
  /**
   * Architecture-ready only — no `@tanstack/react-virtual` runtime yet.
   * Enabling in DEV logs a one-time console warning.
   */
  enabled?: boolean
  estimateSize?: number
}

export type DataRowActionTone = 'default' | 'danger'

export interface DataRowAction<TData> {
  id: string
  label: string
  icon?: string
  tone?: DataRowActionTone
  permission?: string
  disabled?: boolean | ((row: TData) => boolean)
  onClick: (row: TData) => void
}
