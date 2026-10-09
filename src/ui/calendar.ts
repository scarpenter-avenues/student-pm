// The month grid behind the calendar popover. Dates are UTC "YYYY-MM-DD" strings.
import { shiftIsoDate, toUtcDate } from '@/model/dates'

export interface CalendarMonth {
  /** "October 2026" */
  title: string
  /** Empty cells before the 1st (the week starts on Sunday). */
  leading: number
  days: string[]
}

export function calendarMonth(month: string): CalendarMonth {
  const first = toUtcDate(`${month}-01`)
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return {
    title: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    leading: first.getUTCDay(),
    days: Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  }
}

/** "2026-10" → "2026-11" (delta months later). */
export function shiftMonth(month: string, delta: number): string {
  const first = toUtcDate(`${month}-01`)
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1))
    .toISOString()
    .slice(0, 7)
}

/** Arrow keys move by a day or a week. */
export const CALENDAR_MOVES: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
}

export function moveDay(iso: string, key: string): string | null {
  const days = CALENDAR_MOVES[key]
  return days === undefined ? null : shiftIsoDate(iso, days)
}
