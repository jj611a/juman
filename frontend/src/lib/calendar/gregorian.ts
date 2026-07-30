import {
  addDays,
  addMonths,
  endOfMonth,
  format as dfFormat,
  isSameDay,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth
} from 'date-fns'
import { ar } from 'date-fns/locale'
import type { CalendarAdapter, CalendarDayCell, WeekdayIndex } from './types'

function toIsoDate(date: Date): string {
  return dfFormat(date, 'yyyy-MM-dd')
}

export const GregorianCalendarAdapter: CalendarAdapter = {
  id: 'gregorian',

  parse(isoDate: string): Date | null {
    const d = parseISO(isoDate)
    return isValid(d) ? startOfDay(d) : null
  },

  format(date: Date, pattern = 'yyyy-MM-dd'): string {
    return dfFormat(date, pattern, { locale: ar })
  },

  addDays(date, amount) {
    return addDays(date, amount)
  },

  addMonths(date, amount) {
    return addMonths(date, amount)
  },

  startOfMonth(date) {
    return startOfMonth(date)
  },

  endOfMonth(date) {
    return endOfMonth(date)
  },

  isValid(date) {
    return isValid(date)
  },

  getWeekdays(weekStartsOn: WeekdayIndex): string[] {
    const base = startOfDay(new Date(2024, 0, 7)) // Sunday
    const labels: string[] = []
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(base, (weekStartsOn + i) % 7)
      labels.push(dfFormat(d, 'EEEEEE', { locale: ar }))
    }
    return labels
  },

  getMonthGrid(month: Date, weekStartsOn: WeekdayIndex): CalendarDayCell[] {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const startPad = (start.getDay() - weekStartsOn + 7) % 7
    const gridStart = addDays(start, -startPad)
    const cells: CalendarDayCell[] = []
    for (let i = 0; i < 42; i += 1) {
      const date = addDays(gridStart, i)
      cells.push({
        date,
        inCurrentMonth: date >= start && date <= end,
        iso: toIsoDate(date)
      })
    }
    return cells
  },

  isSameDay(a, b) {
    return isSameDay(a, b)
  },

  startOfDay(date) {
    return startOfDay(date)
  }
}
