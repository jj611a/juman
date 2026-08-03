import * as React from 'react'
import { Button, DatePicker, Label } from '@/components/ui'

export interface ReportChromeProps {
  dateFrom?: Date | null
  dateTo?: Date | null
  onDateFromChange?: (date: Date | null) => void
  onDateToChange?: (date: Date | null) => void
  showDateRange?: boolean
  children: React.ReactNode
}

export function ReportChrome({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  showDateRange = true,
  children
}: ReportChromeProps): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {showDateRange ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-40 flex-col gap-1.5">
              <Label htmlFor="report-date-from">من</Label>
              <DatePicker
                id="report-date-from"
                aria-label="من"
                value={dateFrom ?? null}
                onChange={onDateFromChange}
              />
            </div>
            <div className="flex min-w-40 flex-col gap-1.5">
              <Label htmlFor="report-date-to">إلى</Label>
              <DatePicker
                id="report-date-to"
                aria-label="إلى"
                value={dateTo ?? null}
                onChange={onDateToChange}
              />
            </div>
          </div>
        ) : (
          <div />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled title="CSV/JSON عبر /reports/export">
            تصدير CSV/JSON
          </Button>
          <Button type="button" variant="outline" disabled title="PDF غير مدعوم في Backend V2">
            PDF
          </Button>
          <Button type="button" variant="outline" disabled title="Excel غير مدعوم في Backend V2">
            Excel
          </Button>
          <Button type="button" variant="outline" onClick={() => undefined}>
            طباعة
          </Button>
        </div>
      </div>
      {children}
    </div>
  )
}
