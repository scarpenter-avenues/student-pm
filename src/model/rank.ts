// Order is priority: tasks carry a fractional-index `rank`, so moving one rewrites only its own rank. (Subtasks keep
// their order as a list inside the task; see subtasks.ts.)
// Lists are sorted by rank, then id (two devices adding at the same moment can produce the same rank).
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'

/** A rank strictly between two neighbors (null = the start or end of the list). */
export function rankBetween(before: string | null, after: string | null): string {
  // Equal or out-of-order neighbors (a tie from simultaneous adds): sit beside `before`; the id breaks the tie.
  if (before !== null && after !== null && before >= after) return before
  return generateKeyBetween(before, after)
}

/** The rank for a new item at the top or bottom of a list sorted by rank. */
export function rankAt(ranks: readonly string[], position: 'top' | 'bottom'): string {
  return position === 'top'
    ? rankBetween(null, ranks[0] ?? null)
    : rankBetween(ranks.at(-1) ?? null, null)
}

/** The new rank for the item at `from` moved to index `to` (indexes in the list as it is now). */
export function rankForMove(ranks: readonly string[], from: number, to: number): string {
  const others = ranks.filter((_, i) => i !== from)
  return rankBetween(others[to - 1] ?? null, others[to] ?? null)
}

/** Ranks for `count` items in order, e.g. seeding a list or re-ranking subtasks. */
export function ranksFor(count: number): string[] {
  return generateNKeysBetween(null, null, count)
}

/** Sort by rank, then id. */
export function byRank<T extends { rank: string; id: string }>(a: T, b: T): number {
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
