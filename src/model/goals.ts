// Learning goals (WOOP / mental contrasting, implementation intentions), ported from the mock-up. Pure functions;
// views pass in today's date and the team's sprints.
import { daysBetween, shiftIsoDate } from './dates'
import type { GoalIdeaKey, GoalStatus, PlanResult } from './types'

export const GOAL_STATUSES: readonly GoalStatus[] = [
  "Haven't started",
  'Stuck',
  'Making progress',
  'Almost there',
  'Got it',
]
export const PLAN_RESULTS: readonly PlanResult[] = [
  'It worked',
  "It didn't work",
  "It didn't come up",
]
/** Students work on up to 3 goals at once, so check-ins stay quick. */
export const MAX_ACTIVE_GOALS = 3
/** Tap-only, so students aren't invited to type personal details. */
export const PAUSE_REASONS = [
  'Focusing on my other goal',
  'Not the right time in the season',
  'I need to learn something else first',
  'My job on the team changed',
]

/** Built-in ideas for each set-a-goal step. Program coaches can replace any list in Program settings. */
export const DEFAULT_GOAL_IDEAS: Record<GoalIdeaKey, readonly string[]> = {
  wish: [
    'Design 3D printed parts in Onshape',
    'Create assemblies in Onshape',
    'Learn Java for FTC',
    'Learn how to implement a PID controller',
    'Use the shop tools safely',
    'Design a portfolio',
    "Lead by supporting my teammates' progress",
  ],
  evidence: [
    'I can do it without help',
    'I can teach it to a teammate',
    'The code works on the robot in testing',
  ],
  obstacle: [
    'I get distracted',
    'I give up when something gets confusing',
    "I'm not sure where to start",
    'I run out of time',
    "I'm nervous to ask for help",
  ],
  // The "then I will…" half of an if-then plan.
  plan: [
    'ask a teammate for 10 minutes of help',
    'do some research',
    'break it into one small next piece',
    "write down where I'm stuck and ask a mentor",
    'set a 15-minute timer and focus',
  ],
  // Fill-in-the-blank starters nudge students toward specific, doable tasks.
  firstStep: [
    'Watch a tutorial on ___',
    'Ask ___ to teach me how to ___',
    'Build a cardboard prototype of ___',
  ],
}
export const GOAL_IDEA_KEYS = Object.keys(DEFAULT_GOAL_IDEAS) as GoalIdeaKey[]
/** Program coaches can list up to this many ideas per step, each up to this many characters. */
export const MAX_GOAL_IDEAS = 12
export const MAX_GOAL_IDEA_LENGTH = 80

/** A program's ideas for one step: its own list when it has one (even an empty one), else the defaults. */
export function goalIdeasFor(
  program: { goalIdeas?: Partial<Record<GoalIdeaKey, string[]>> } | null | undefined,
  key: GoalIdeaKey,
): readonly string[] {
  return program?.goalIdeas?.[key] ?? DEFAULT_GOAL_IDEAS[key]
}

export type GoalStepKey = 'wish' | 'evidence' | 'by' | 'obstacle' | 'plan' | 'firstStep'
export interface GoalStep {
  key: GoalStepKey
  title: string
  lead: string
  starter?: string
  hint?: (value: string) => string
}
export const GOAL_STEPS: readonly GoalStep[] = [
  {
    key: 'wish',
    title: 'What do you want to learn or get better at?',
    lead: 'Start with a verb, like Learn, Design, Create, or Use.',
    hint: (v) =>
      /\b(win|score|points|rank|first place|beat)\b/i.test(v)
        ? 'That sounds like a result. Try naming the skill behind it.'
        : '',
  },
  {
    key: 'evidence',
    title: "How will you know you've got it?",
    lead: "I'll know I've got it when…",
    hint: (v) =>
      /\b(feel|understand|know|better|good at|comfortable)\b/i.test(v)
        ? "Could a teammate tell you've done it? Try something you can show or point to."
        : '',
  },
  { key: 'by', title: 'By when?', lead: 'Pick an event or a date. You can change it later.' },
  {
    key: 'obstacle',
    title: "What's most likely to get in your way?",
    lead: 'Think about you, not other people. Something that might stop me is…',
    hint: (v) =>
      /\b(they|them|teammates?|nobody|everyone|coach|mentor)\b/i.test(v)
        ? 'Try naming something you can control. What do you tend to do?'
        : '',
  },
  {
    key: 'plan',
    title: 'Make an if-then plan',
    lead: 'When that obstacle shows up, what will you do?',
    starter: 'If ___, then I will ___',
    hint: (v) => (v && !/\bthen\b/i.test(v) ? 'Try the shape “If ___, then I will ___.”' : ''),
  },
  {
    key: 'firstStep',
    title: "What's one thing you'll do this sprint?",
    lead: 'This task will be added to your team board.',
    hint: (v) => (/_{2,}/.test(v) ? 'Fill in the blanks to make it specific.' : ''),
  },
]

/** "I give up when it's confusing." → the "If ___" part of a plan. */
export function planCondition(obstacle: string): string {
  const text = obstacle.trim().replace(/[.!]+$/, '')
  return /^I\b|^I'/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1)
}

/** Fill-in-the-blank text still has blanks ("___"). */
export const hasBlanks = (text: string) => /_{2,}/.test(text)
export const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim()

export interface GoalLike {
  state: 'active' | 'paused' | 'done' | 'changed'
  status: GoalStatus
  by: { label: string; date: string | null }
  /** Calendar date the goal was set. */
  created: string
  lastCheckinAt: string | null
  lastFeedbackAt: string | null
  unreadFeedback: number
}

export function datePassed(goal: Pick<GoalLike, 'state' | 'by'>, today: string): boolean {
  return goal.state === 'active' && !!goal.by.date && goal.by.date < today
}

export interface SprintLike {
  name: string
  start: string
  end: string
}
export interface CheckinWindow {
  /** Check-ins on or after this date count. */
  start: string
  sprint: SprintLike
  overdue: boolean
}

/**
 * A check-in is due once per sprint: in the last two days of the current sprint, or overdue if the previous sprint
 * ended without one. `sprints` are in order.
 */
export function checkinWindow(sprints: readonly SprintLike[], today: string): CheckinWindow | null {
  const index = sprints.findIndex((sprint) => today >= sprint.start && today <= sprint.end)
  const current = sprints[index]
  if (!current) return null
  if (daysBetween(today, current.end) <= 2)
    return { start: shiftIsoDate(current.end, -2), sprint: current, overdue: false }
  const previous = sprints[index - 1]
  return previous
    ? { start: shiftIsoDate(previous.end, -2), sprint: previous, overdue: true }
    : null
}

/** The check-in this goal owes, or null. */
export function checkinDue(
  goal: Pick<GoalLike, 'state' | 'created' | 'lastCheckinAt'>,
  window: CheckinWindow | null,
): CheckinWindow | null {
  if (goal.state !== 'active' || !window || goal.created >= window.start) return null
  return goal.lastCheckinAt && goal.lastCheckinAt >= window.start ? null : window
}

export type Tone = 'warn' | 'info' | 'alert' | 'good'
export type Flag = [text: string, tone: Tone]

/** Attention flags for one goal (null: a student with no active goal). */
export function goalFlags(
  goal: GoalLike | null,
  window: CheckinWindow | null,
  today: string,
  { paused = 0, recentlyDone = false } = {},
): Flag[] {
  const flags: Flag[] = []
  if (!goal) {
    flags.push(paused ? ['Goal paused', 'info'] : ['No goal yet', 'warn'])
    if (recentlyDone) flags.push(['Goal completed 🎉', 'good'])
    return flags
  }
  if (!goal.lastFeedbackAt)
    flags.push(
      daysBetween(goal.created, today) <= 14
        ? ['New goal · needs feedback', 'info']
        : ['No coach feedback yet', 'warn'],
    )
  const due = checkinDue(goal, window)
  if (due)
    flags.push([due.overdue ? 'Check-in overdue' : 'Check-in due', due.overdue ? 'warn' : 'info'])
  if (datePassed(goal, today)) flags.push(['Date passed', 'warn'])
  if (goal.status === 'Stuck') flags.push(['Stuck', 'alert'])
  if (goal.lastCheckinAt && goal.lastFeedbackAt && goal.lastFeedbackAt < goal.lastCheckinAt)
    flags.push(['Check-in needs a response', 'info'])
  return flags
}

const NEED_ORDER: Flag[] = [
  ['Check-in overdue', 'warn'],
  ['Date passed', 'warn'],
  ['Needs feedback', 'warn'],
  ['No goal yet', 'warn'],
  ['Goal paused', 'info'],
]
const FEEDBACK_FLAGS = [
  'No coach feedback yet',
  'New goal · needs feedback',
  'Check-in needs a response',
]

/** What a coach needs to do, most urgent first. Feedback flags merge into "Needs feedback"; "Stuck" isn't repeated. */
export function coachNeeds(flags: readonly Flag[]): Flag[] {
  const names = new Set(
    flags.map(([text]) => (FEEDBACK_FLAGS.includes(text) ? 'Needs feedback' : text)),
  )
  return NEED_ORDER.filter(([text]) => names.has(text))
}

/** Needs the coach: any need, or the student says they're stuck. */
export function needsCoach(flags: readonly Flag[], status: GoalStatus | null): boolean {
  return coachNeeds(flags).length > 0 || status === 'Stuck'
}

/** "Qualifier 2 · Nov 8" (the date is left off when the label already has it). */
export function byLabel(
  by: { label: string; date: string | null },
  shortDate: (iso: string) => string,
): string {
  if (!by.date) return by.label
  const date = shortDate(by.date)
  return by.label.includes(date) ? by.label : `${by.label} · ${date}`
}
