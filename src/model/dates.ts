// Calendar dates are "YYYY-MM-DD" strings, handled in UTC so they never shift with time zones.

export function toUtcDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day!))
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function shiftIsoDate(iso: string, days: number): string {
  const date = toUtcDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000)
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

/** A moment's calendar date where the person is ("2026-10-09"). */
export function localIso(moment: Date): string {
  return todayIso(moment)
}
