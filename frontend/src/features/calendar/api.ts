import { apiClient } from '@/services/apiClient'
import type { CalendarBlockCreateBody, CalendarBlockUpdateBody } from '@/services/domainTypes'

export const calendarKeys = {
  all: ['calendar'] as const,
  timeline: (dressId: string, from: string, to: string) =>
    [...calendarKeys.all, 'timeline', dressId, from, to] as const,
  availability: (dressId: string, start: string, end: string) =>
    [...calendarKeys.all, 'availability', dressId, start, end] as const,
  conflicts: (dressId: string, start: string, end: string) =>
    [...calendarKeys.all, 'conflicts', dressId, start, end] as const
}

export const calendarApi = {
  timeline: (dressId: string, from: string, to: string) =>
    apiClient.calendar.timeline(dressId, { from, to }),
  availability: (dressId: string, start_at: string, end_at: string) =>
    apiClient.calendar.availability(dressId, { start_at, end_at }),
  conflicts: (dressId: string, start_at: string, end_at: string) =>
    apiClient.calendar.conflicts(dressId, { start_at, end_at }),
  createBlock: (body: CalendarBlockCreateBody) => apiClient.calendar.createBlock(body),
  updateBlock: (id: string, body: CalendarBlockUpdateBody) =>
    apiClient.calendar.updateBlock(id, body),
  deleteBlock: (id: string) => apiClient.calendar.deleteBlock(id)
}
