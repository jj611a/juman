import * as React from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TextInput } from '@/components/ui/text-input'
import {
  defaultCalendarAdapter,
  type CalendarAdapter,
  type WeekdayIndex
} from '@/lib/calendar'
import { cn } from '@/utils/cn'

export interface DatePickerProps {
  value?: Date | null
  defaultValue?: Date | null
  onChange?: (date: Date | null) => void
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  className?: string
  adapter?: CalendarAdapter
  weekStartsOn?: WeekdayIndex
  minDate?: Date
  maxDate?: Date
  disabledDates?: (date: Date) => boolean
  /** Reserved for future range mode; unused in v1. */
  mode?: 'single' | 'range'
  'aria-label'?: string
  id?: string
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      defaultValue = null,
      onChange,
      placeholder = 'اختر التاريخ',
      disabled,
      readOnly,
      className,
      adapter = defaultCalendarAdapter,
      weekStartsOn = 6,
      minDate,
      maxDate,
      disabledDates,
      mode: _mode = 'single',
      'aria-label': ariaLabel,
      id
    },
    ref
  ) => {
    void _mode
    const isControlled = value !== undefined
    const [internal, setInternal] = React.useState<Date | null>(defaultValue)
    const selected = isControlled ? value : internal
    const [open, setOpen] = React.useState(false)
    const [month, setMonth] = React.useState<Date>(selected ?? new Date())

    React.useEffect(() => {
      if (selected) setMonth(selected)
    }, [selected])

    const setSelected = (date: Date | null): void => {
      if (!isControlled) setInternal(date)
      onChange?.(date)
    }

    const display = selected ? adapter.format(selected, 'yyyy-MM-dd') : ''

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className={cn('w-full', className)}>
            <TextInput
              ref={ref}
              id={id}
              readOnly
              disabled={disabled || readOnly}
              aria-label={ariaLabel}
              leadingIcon="Calendar"
              placeholder={placeholder}
              value={display}
              onClick={() => !disabled && !readOnly && setOpen(true)}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <Calendar
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={(date) => {
              setSelected(adapter.startOfDay(date))
              setOpen(false)
            }}
            adapter={adapter}
            weekStartsOn={weekStartsOn}
            minDate={minDate}
            maxDate={maxDate}
            disabledDates={disabledDates}
          />
        </PopoverContent>
      </Popover>
    )
  }
)
DatePicker.displayName = 'DatePicker'

/** Calendar field alias — same public DatePicker compose. */
export const CalendarInput = DatePicker
