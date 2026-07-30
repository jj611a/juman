export type { CalendarAdapter, CalendarDayCell, DateRangeValue, WeekdayIndex } from './types'
export { GregorianCalendarAdapter } from './gregorian'

import { GregorianCalendarAdapter } from './gregorian'
import type { CalendarAdapter } from './types'

/** Active calendar for DatePicker — swap later without changing component props. */
export const defaultCalendarAdapter: CalendarAdapter = GregorianCalendarAdapter
