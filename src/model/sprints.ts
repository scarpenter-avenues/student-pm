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
