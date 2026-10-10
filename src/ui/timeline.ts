// Timeline layout (ported from the mock-up's renderTimeline): where bars go and which lane each takes.
import { daysBetween, shiftIsoDate } from '@/model/dates'

export const TIMELINE_ZOOMS = [
  { label: 'Months', day: 12 },
  { label: 'Weeks', day: 24 },
  { label: 'Days', day: 44 },
] as const

/** A task's [first, last] day, from its start and due dates (either alone works); null without dates. */
export function dateSpan({
  start,
  due,
}: {
  start: string | null
  due: string | null
}): [string, string] | null {
  if (!start && !due) return null
  const first = (start ?? due)!
  const last = (due ?? start)!
  return first <= last ? [first, last] : [last, first]
}

export function barWidth(span: [string, string], dayWidth: number): number {
  return (daysBetween(span[0], span[1]) + 1) * dayWidth - 4
}

/** Bar contents: status icon · title · initials · (subtask count). +8 lets a nearly full bar run past instead of clipping. */
export function contentWidth(titleWidth: number, people: number, hasSubtaskCount: boolean): number {
  return (
    14 +
    14 +
    7 +
    titleWidth +
    7 +
    (20 + (Math.min(2, people || 1) - 1) * 17) +
    (hasSubtaskCount ? 7 + 37 : 0) +
    8
  )
}

/** Days a title that runs past its bar reaches, so the next bar in the lane leaves room. */
export function overflowDays(overflowPx: number, dayWidth: number): number {
  return overflowPx > 0 ? Math.ceil((overflowPx + 10) / dayWidth) : 0
}

export interface Packable {
  packStart: string
  packEnd: string
}

/** Greedy lanes: each item takes the first lane whose last item ends before it starts. Returns the lane per item. */
export function packLanes<T extends Packable>(
  items: readonly T[],
): { lanes: number[]; count: number } {
  const order = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.packStart.localeCompare(b.item.packStart))
  const ends: string[] = []
  const lanes: number[] = new Array(items.length).fill(0)
  order.forEach(({ item, index }) => {
    let lane = ends.findIndex((end) => end < item.packStart)
    if (lane === -1) {
      lane = ends.length
      ends.push(item.packEnd)
    } else ends[lane] = item.packEnd
    lanes[index] = lane
  })
  return { lanes, count: ends.length }
}

/** The first and last day shown: the season's sprints. */
export function timelineRange(sprints: readonly { start: string; end: string }[]) {
  const start = sprints[0]?.start
  const end = sprints.at(-1)?.end
  return start && end ? { start, days: daysBetween(start, end) + 1 } : null
}

export { daysBetween, shiftIsoDate }
