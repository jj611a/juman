export type CalendarViewMode = 'month' | 'week' | 'day'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Sunday-start week (common for IQ Gregorian UI). */
function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() - x.getDay())
  return x
}

export function visibleRange(anchor: Date, mode: CalendarViewMode): { from: Date; to: Date } {
  if (mode === 'day') {
    const from = startOfDay(anchor)
    return { from, to: addDays(from, 1) }
  }
  if (mode === 'week') {
    const from = startOfWeek(anchor)
    return { from, to: addDays(from, 7) }
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const from = startOfWeek(first)
  const nextMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
  const lastGrid = addDays(startOfWeek(addDays(nextMonth, -1)), 7)
  return { from, to: lastGrid }
}

export function toIso(d: Date): string {
  return d.toISOString()
}

export function shiftAnchor(anchor: Date, mode: CalendarViewMode, dir: -1 | 1): Date {
  const x = new Date(anchor)
  if (mode === 'day') x.setDate(x.getDate() + dir)
  else if (mode === 'week') x.setDate(x.getDate() + dir * 7)
  else x.setMonth(x.getMonth() + dir)
  return x
}

export function formatRangeLabel(anchor: Date, mode: CalendarViewMode): string {
  if (mode === 'month') {
    return anchor.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long' })
  }
  const { from, to } = visibleRange(anchor, mode)
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
  return `${from.toLocaleDateString('ar-IQ', opts)} → ${addDays(to, -1).toLocaleDateString('ar-IQ', opts)}`
}

export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = []
  let cur = startOfDay(from)
  const end = startOfDay(to)
  while (cur < end) {
    days.push(new Date(cur))
    cur = addDays(cur, 1)
  }
  return days
}

export function overlapsDay(startAt: string, endAt: string, day: Date): boolean {
  const s = new Date(startAt).getTime()
  const e = new Date(endAt).getTime()
  const a = startOfDay(day).getTime()
  const b = addDays(day, 1).getTime()
  return s < b && e > a
}
