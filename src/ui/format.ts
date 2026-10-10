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

/** A moment as people read it: "Today · 9:12 AM", "Yesterday · 3:40 PM", "Oct 5 · 8:00 AM". */
export function formatMoment(at: { toDate(): Date } | null | undefined, now = new Date()): string {
  if (!at) return ''
  const date = at.toDate()
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(now) - day(date)) / 86_400_000)
  if (days === 0) return `Today · ${time}`
  if (days === 1) return `Yesterday · ${time}`
  const sameYear = date.getFullYear() === now.getFullYear()
  const label = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return `${label} · ${time}`
}

/** "Oct 2 – Oct 17" */
export function formatRange(start: string, end: string): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`
}

/** "2026-10-02" → "Oct. 2" (sprint headings). May, June, July have no dot. */
export function formatDotted(iso: string): string {
  return formatShortDate(iso).replace(/^([A-Z][a-z]{2}) /, (_, month: string) =>
    ['May', 'Jun', 'Jul'].includes(month) ? `${month} ` : `${month}. `,
  )
}

/** "1 task", "3 tasks" */
export function plural(count: number, word: string, many = `${word}s`): string {
  return `${count} ${count === 1 ? word : many}`
}
