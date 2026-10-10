import { describe, expect, it } from 'vitest'
import {
  checkinDue,
  checkinWindow,
  coachNeeds,
  DEFAULT_GOAL_IDEAS,
  goalIdeasFor,
  datePassed,
  goalFlags,
  planCondition,
  type GoalLike,
} from '../goals'

const sprints = [
  { name: 'Sprint 2', start: '2026-09-15', end: '2026-10-01' },
  { name: 'Sprint 3', start: '2026-10-02', end: '2026-10-17' },
]
const goal = (overrides: Partial<GoalLike> = {}): GoalLike => ({
  state: 'active',
  status: 'Making progress',
  by: { label: 'Qualifier 2', date: '2026-11-08' },
  created: '2026-09-08',
  lastCheckinAt: '2026-09-15',
  lastFeedbackAt: '2026-09-16',
  unreadFeedback: 0,
  ...overrides,
})

describe('check-ins', () => {
  it('is overdue mid-sprint when the last sprint ended without one', () => {
    const window = checkinWindow(sprints, '2026-10-09')
    expect(window).toMatchObject({
      start: '2026-09-29',
      overdue: true,
      sprint: { name: 'Sprint 2' },
    })
    expect(checkinDue(goal(), window)).toBe(window)
    expect(checkinDue(goal({ lastCheckinAt: '2026-09-30' }), window)).toBeNull()
  })
  it('is due in the last two days of the current sprint', () => {
    expect(checkinWindow(sprints, '2026-10-15')).toMatchObject({
      start: '2026-10-15',
      overdue: false,
    })
  })
  it('skips new and inactive goals', () => {
    const window = checkinWindow(sprints, '2026-10-09')
    expect(checkinDue(goal({ created: '2026-10-01' }), window)).toBeNull()
    expect(checkinDue(goal({ state: 'paused' }), window)).toBeNull()
  })
})

describe('coach flags', () => {
  it('flags passed dates, overdue check-ins, and check-ins that need a response', () => {
    const window = checkinWindow(sprints, '2026-10-09')
    const flags = goalFlags(
      goal({ by: { label: 'End of Sprint 2', date: '2026-10-01' }, lastCheckinAt: '2026-09-20' }),
      window,
      '2026-10-09',
    )
    expect(flags.map(([text]) => text)).toEqual([
      'Check-in overdue',
      'Date passed',
      'Check-in needs a response',
    ])
    expect(coachNeeds(flags).map(([text]) => text)).toEqual([
      'Check-in overdue',
      'Date passed',
      'Needs feedback',
    ])
  })
  it('a new goal without feedback, and students without goals', () => {
    expect(
      goalFlags(
        goal({ created: '2026-10-05', lastFeedbackAt: null, lastCheckinAt: null }),
        null,
        '2026-10-09',
      )[0]![0],
    ).toBe('New goal · needs feedback')
    expect(goalFlags(null, null, '2026-10-09', { paused: 1 })).toEqual([['Goal paused', 'info']])
  })
  it('date passed only for active goals', () => {
    expect(datePassed(goal({ by: { label: 'x', date: '2026-10-01' } }), '2026-10-09')).toBe(true)
    expect(
      datePassed(goal({ state: 'paused', by: { label: 'x', date: '2026-10-01' } }), '2026-10-09'),
    ).toBe(false)
  })
})

describe('planCondition', () => {
  it('keeps "I…" and lowercases the rest', () => {
    expect(planCondition('I give up when it gets confusing.')).toBe(
      'I give up when it gets confusing',
    )
    expect(planCondition('Tutorials get confusing')).toBe('tutorials get confusing')
  })
})

describe('goal ideas', () => {
  it("uses the program's list when it has one (even empty), else the defaults", () => {
    expect(goalIdeasFor(null, 'wish')).toBe(DEFAULT_GOAL_IDEAS.wish)
    expect(goalIdeasFor({ goalIdeas: { plan: ['ask a mentor'] } }, 'wish')).toBe(
      DEFAULT_GOAL_IDEAS.wish,
    )
    expect(goalIdeasFor({ goalIdeas: { plan: ['ask a mentor'] } }, 'plan')).toEqual([
      'ask a mentor',
    ])
    expect(goalIdeasFor({ goalIdeas: { evidence: [] } }, 'evidence')).toEqual([])
  })
})
