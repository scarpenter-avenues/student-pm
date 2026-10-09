/** "Avery K." → "AK", "Coach Rivera" → "CR". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.match(/\p{L}|\d/u)?.[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase()
}

/** "2026-11-08" → "Sun, Nov 8" (dates are UTC "YYYY-MM-DD" strings, so no time-zone shift). */
export function formatEventDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** 0 → "Today", 1 → "Tomorrow", n → "n days". */
export function daysAway(days: number): string {
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`
}

/** "2026-10-06" → "Oct 6"; null → "—". */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
