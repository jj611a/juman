import * as React from 'react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import {
  defaultCalendarAdapter,
  type CalendarAdapter,
  type WeekdayIndex
} from '@/lib/calendar'
import { cn } from '@/utils/cn'

export interface CalendarProps {
  month: Date
  onMonthChange: (month: Date) => void
  selected?: Date | null
  onSelect?: (date: Date) => void
  adapter?: CalendarAdapter
  weekStartsOn?: WeekdayIndex
  minDate?: Date
  maxDate?: Date
  disabledDates?: (date: Date) => boolean
  className?: string
}

export function Calendar({
  month,
  onMonthChange,
  selected = null,
  onSelect,
  adapter = defaultCalendarAdapter,
  weekStartsOn = 6,
  minDate,
  maxDate,
  disabledDates,
  className
}: CalendarProps): React.ReactElement {
  const weekdays = adapter.getWeekdays(weekStartsOn)
  const cells = adapter.getMonthGrid(month, weekStartsOn)
  const today = adapter.startOfDay(new Date())

  const isDisabled = (date: Date): boolean => {
    if (minDate && adapter.startOfDay(date) < adapter.startOfDay(minDate)) return true
    if (maxDate && adapter.startOfDay(date) > adapter.startOfDay(maxDate)) return true
    if (disabledDates?.(date)) return true
    return false
  }

  return (
    <div className={cn('flex w-full flex-col gap-3', className)} dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <IconButton
          icon="ChevronRight"
          aria-label="الشهر السابق"
          size="sm"
          variant="ghost"
          onClick={() => onMonthChange(adapter.addMonths(month, -1))}
        />
        <p className="text-title text-foreground">{adapter.format(month, 'MMMM yyyy')}</p>
        <IconButton
          icon="ChevronLeft"
          aria-label="الشهر التالي"
          size="sm"
          variant="ghost"
          onClick={() => onMonthChange(adapter.addMonths(month, 1))}
        />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((d) => (
          <div key={d} className="py-1 text-center text-caption text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((cell) => {
          const disabled = isDisabled(cell.date)
          const isSelected = selected ? adapter.isSameDay(cell.date, selected) : false
          const isToday = adapter.isSameDay(cell.date, today)
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              aria-label={cell.iso}
              aria-current={isToday ? 'date' : undefined}
              aria-selected={isSelected || undefined}
              className={cn(
                'flex size-9 items-center justify-center rounded-md text-caption transition-colors',
                !cell.inCurrentMonth && 'text-muted-foreground/50',
                cell.inCurrentMonth && 'text-foreground',
                isToday && !isSelected && 'border border-brand-border',
                isSelected && 'bg-brand text-brand-foreground',
                !isSelected && !disabled && 'hover:bg-brand-subtle',
                disabled && 'opacity-[var(--disabled-opacity)]'
              )}
              onClick={() => onSelect?.(cell.date)}
            >
              {adapter.format(cell.date, 'd')}
            </button>
          )
        })}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => {
          onMonthChange(today)
          onSelect?.(today)
        }}
      >
        اليوم
      </Button>
    </div>
  )
}
