// Huddles: the plan a new huddle can start from. Pure; no Firebase.
import type { HuddlePlanRow, Program } from './types'

/** Until a program sets its own default plan (Program settings), "Import default" uses this one. */
export const DEFAULT_HUDDLE_PLAN: readonly HuddlePlanRow[] = [
  { time: '15:30', text: 'All-hands: qualifier timeline (5 min)', audience: ['all'] },
  { time: '15:40', text: 'Goal check-ins with anyone overdue', audience: ['all'] },
  { time: '16:00', text: 'Portfolio work session in the library', audience: ['all'] },
  { time: '16:00', text: 'Intake testing on the field', audience: ['all'] },
  { time: '17:30', text: 'Pack-up and battery charging', audience: ['all'] },
]

/** The program's default huddle plan (its own, or the built-in one), as fresh rows to edit. */
export function defaultHuddlePlan(program: Pick<Program, 'huddlePlan'> | null | undefined) {
  return (program?.huddlePlan ?? DEFAULT_HUDDLE_PLAN).map((row) => ({
    ...row,
    audience: [...row.audience],
  }))
}

/** Rows worth keeping: trimmed, with text, in time order. */
export function cleanPlan(rows: readonly HuddlePlanRow[]): HuddlePlanRow[] {
  return rows
    .filter((row) => row.text.trim())
    .map(({ time, text, audience, runBy }) => ({
      time,
      text: text.trim(),
      audience: [...audience],
      ...(runBy ? { runBy } : {}),
    }))
    .sort((a, b) => a.time.localeCompare(b.time))
}
