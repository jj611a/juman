export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface CalendarDayCell {
  date: Date
  inCurrentMonth: boolean
  iso: string
}

export interface CalendarAdapter {
  readonly id: string
  parse(isoDate: string): Date | null
  format(date: Date, pattern?: string): string
  addDays(date: Date, amount: number): Date
  addMonths(date: Date, amount: number): Date
  startOfMonth(date: Date): Date
  endOfMonth(date: Date): Date
  isValid(date: Date): boolean
  /** Localized short weekday labels starting at weekStartsOn. */
  getWeekdays(weekStartsOn: WeekdayIndex, locale?: string): string[]
  getMonthGrid(month: Date, weekStartsOn: WeekdayIndex): CalendarDayCell[]
  isSameDay(a: Date, b: Date): boolean
  startOfDay(date: Date): Date
}

export interface DateRangeValue {
  from: Date | null
  to: Date | null
}
