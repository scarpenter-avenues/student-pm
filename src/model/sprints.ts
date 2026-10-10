// A season's sprint calendar: back-to-back sprints of `sprintDays` from the season's first day.
// Used by the setup script, the demo data, and (later) "Start a new season".
import { daysBetween, shiftIsoDate } from './dates'

export interface SprintDates {
  index: number
  name: string
  start: string
  end: string
}

/**
 * Sprints from `start` until `end`. The last sprint is stretched to finish on `end` if a short remainder would
 * otherwise be left over (under half a sprint), and trimmed to `end` if it would run past it.
 */
export function buildSprints(start: string, end: string, sprintDays: number): SprintDates[] {
  if (sprintDays < 1) throw new Error('sprintDays must be at least 1')
  if (end < start) throw new Error(`Season ends (${end}) before it starts (${start})`)
  const sprints: SprintDates[] = []
  let sprintStart = start
  while (sprintStart <= end) {
    let sprintEnd = shiftIsoDate(sprintStart, sprintDays - 1)
    const remaining = daysBetween(sprintEnd, end)
    if (remaining > 0 && remaining < sprintDays / 2) sprintEnd = end
    if (sprintEnd > end) sprintEnd = end
    sprints.push({
      index: sprints.length,
      name: `Sprint ${sprints.length + 1}`,
      start: sprintStart,
      end: sprintEnd,
    })
    sprintStart = shiftIsoDate(sprintEnd, 1)
  }
  return sprints
}

/** Index of the sprint containing `date`, clamped to the first or last sprint. */
export function sprintIndexOn(sprints: SprintDates[], date: string): number {
  if (!sprints.length) return -1
  if (date < sprints[0]!.start) return 0
  const found = sprints.findIndex((sprint) => date >= sprint.start && date <= sprint.end)
  return found === -1 ? sprints.length - 1 : found
}

export interface SprintSpan {
  id: string
  start: string
  end: string
}

/**
 * New dates for sprint `index` (ported from the mock-up's saveSprintDateRange). Sprints are at least a week long;
 * moving the start also ends the sprint before it the day before; moving the end shifts every later sprint by the same
 * number of days. Returns only the sprints that changed.
 */
export function rescheduleSprint(
  sprints: readonly SprintSpan[],
  index: number,
  { start: wantedStart, end: wantedEnd }: { start?: string; end?: string },
): SprintSpan[] {
  const list = sprints.map((sprint) => ({ ...sprint }))
  const sprint = list[index]
  if (!sprint) return []
  const previousEnd = sprint.end
  const start = wantedStart ?? sprint.start
  let end = wantedEnd ?? sprint.end
  if (end < shiftIsoDate(start, 6)) end = shiftIsoDate(start, 6)
  const before = list[index - 1]
  if (before && start !== sprint.start) before.end = shiftIsoDate(start, -1)
  sprint.start = start
  sprint.end = end
  const delta = daysBetween(previousEnd, end)
  for (const later of list.slice(index + 1)) {
    later.start = shiftIsoDate(later.start, delta)
    later.end = shiftIsoDate(later.end, delta)
  }
  return list.filter((next, i) => next.start !== sprints[i]!.start || next.end !== sprints[i]!.end)
}

/** The earliest day sprint `index` may start or end on (a sprint is at least a week; see rescheduleSprint). */
export function earliestSprintDate(
  sprints: readonly SprintSpan[],
  index: number,
  edge: 'start' | 'end',
): string | null {
  if (edge === 'end') return shiftIsoDate(sprints[index]!.start, 6)
  const before = sprints[index - 1]
  return before ? shiftIsoDate(before.start, 7) : null
}
