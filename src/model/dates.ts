// Calendar dates are "YYYY-MM-DD" strings, handled in UTC so they never shift with time zones.

/** "2026-10-11" → a Date at midnight UTC that day. */
export function toUtcDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day!))
}

/** A Date → its "2026-10-11" text (the UTC day). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The date `days` after `iso` (negative for before). Months and leap years are handled for you. */
export function shiftIsoDate(iso: string, days: number): string {
  const date = toUtcDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date)
}

/** How many days from `from` to `to`: 0 for the same day, negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000)
}

/** Today's date where the person is. Tests pass in `now` so they don't depend on the real clock. */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

/** A moment's calendar date where the person is ("2026-10-09"). */
export function localIso(moment: Date): string {
  return todayIso(moment)
}
