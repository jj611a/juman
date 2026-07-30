import * as React from 'react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { DataPaginationState } from '@/components/ui/data-table/types'
import { cn } from '@/utils/cn'

export interface PaginationProps {
  pagination: DataPaginationState
  onPaginationChange: (next: DataPaginationState) => void
  /** Total pages when known (server). Derived from pageCount or totalItems. */
  pageCount?: number
  totalItems?: number
  pageSizeOptions?: number[]
  className?: string
  disabled?: boolean
}

export function Pagination({
  pagination,
  onPaginationChange,
  pageCount: pageCountProp,
  totalItems,
  pageSizeOptions = [10, 20, 50, 100],
  className,
  disabled = false
}: PaginationProps): React.ReactElement {
  const pageCount =
    pageCountProp ??
    (totalItems != null
      ? Math.max(1, Math.ceil(totalItems / Math.max(1, pagination.pageSize)))
      : 1)

  const pageIndex = pagination.pageIndex
  const canPrev = pageIndex > 0
  const canNext = pageIndex < pageCount - 1

  const setPage = (pageIndexNext: number): void => {
    onPaginationChange({
      ...pagination,
      pageIndex: Math.min(Math.max(0, pageIndexNext), Math.max(0, pageCount - 1))
    })
  }

  return (
    <div
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
      role="navigation"
      aria-label="ترقيم الصفحات"
    >
      <div className="flex items-center gap-2 text-caption text-muted-foreground">
        <span>حجم الصفحة</span>
        <Select
          value={String(pagination.pageSize)}
          disabled={disabled}
          onValueChange={(v) =>
            onPaginationChange({ pageIndex: 0, pageSize: Number(v) })
          }
        >
          <SelectTrigger className="h-8 w-[4.5rem]" aria-label="حجم الصفحة">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <IconButton
          icon="ChevronsRight"
          size="sm"
          variant="outline"
          aria-label="الصفحة الأولى"
          disabled={disabled || !canPrev}
          onClick={() => setPage(0)}
        />
        <IconButton
          icon="ChevronRight"
          size="sm"
          variant="outline"
          aria-label="السابق"
          disabled={disabled || !canPrev}
          onClick={() => setPage(pageIndex - 1)}
        />
        <Button variant="ghost" size="sm" disabled className="min-w-24 pointer-events-none">
          {pageIndex + 1} / {pageCount}
        </Button>
        <IconButton
          icon="ChevronLeft"
          size="sm"
          variant="outline"
          aria-label="التالي"
          disabled={disabled || !canNext}
          onClick={() => setPage(pageIndex + 1)}
        />
        <IconButton
          icon="ChevronsLeft"
          size="sm"
          variant="outline"
          aria-label="الصفحة الأخيرة"
          disabled={disabled || !canNext}
          onClick={() => setPage(pageCount - 1)}
        />
      </div>
    </div>
  )
}
