import { describe, expect, it } from 'vitest'
import { buildSprints, earliestSprintDate, rescheduleSprint, sprintIndexOn } from '../sprints'
import { daysBetween, shiftIsoDate } from '../dates'

describe('buildSprints', () => {
  it('builds back-to-back sprints of the given length', () => {
    const sprints = buildSprints('2026-09-01', '2026-10-12', 14)
    expect(sprints.map((s) => [s.name, s.start, s.end])).toEqual([
      ['Sprint 1', '2026-09-01', '2026-09-14'],
      ['Sprint 2', '2026-09-15', '2026-09-28'],
      ['Sprint 3', '2026-09-29', '2026-10-12'],
    ])
  })
  it('folds a short leftover into the last sprint', () => {
    // 3 days left after Sprint 2 (under half of 14): Sprint 2 runs to the end instead.
    const sprints = buildSprints('2026-09-01', '2026-10-01', 14)
    expect(sprints).toHaveLength(2)
    expect(sprints.at(-1)!.end).toBe('2026-10-01')
  })
  it('trims a long leftover into a final short sprint', () => {
    const sprints = buildSprints('2026-09-01', '2026-10-06', 14)
    expect(sprints.at(-1)).toMatchObject({
      name: 'Sprint 3',
      start: '2026-09-29',
      end: '2026-10-06',
    })
  })
  it('covers a whole season with no gaps or overlaps', () => {
    const sprints = buildSprints('2026-09-01', '2027-03-31', 10)
    expect(sprints[0]!.start).toBe('2026-09-01')
    expect(sprints.at(-1)!.end).toBe('2027-03-31')
    sprints
      .slice(1)
      .forEach((sprint, i) => expect(sprint.start).toBe(shiftIsoDate(sprints[i]!.end, 1)))
    sprints.forEach((sprint) =>
      expect(daysBetween(sprint.start, sprint.end)).toBeGreaterThanOrEqual(0),
    )
  })
  it('rejects nonsense', () => {
    expect(() => buildSprints('2026-09-01', '2026-08-01', 14)).toThrow('ends')
    expect(() => buildSprints('2026-09-01', '2026-10-01', 0)).toThrow('sprintDays')
  })
})

describe('sprintIndexOn', () => {
  const sprints = buildSprints('2026-09-01', '2026-10-12', 14)
  it('finds the sprint containing a date, clamped to the season', () => {
    expect(sprintIndexOn(sprints, '2026-09-20')).toBe(1)
    expect(sprintIndexOn(sprints, '2026-01-01')).toBe(0)
    expect(sprintIndexOn(sprints, '2027-01-01')).toBe(2)
  })
})

describe('rescheduleSprint', () => {
  const sprints = [
    { id: 's1', start: '2026-09-01', end: '2026-09-14' },
    { id: 's2', start: '2026-09-15', end: '2026-09-28' },
    { id: 's3', start: '2026-09-29', end: '2026-10-12' },
  ]
  it('a later end shifts every later sprint by the same days', () => {
    expect(rescheduleSprint(sprints, 1, { end: '2026-09-30' })).toEqual([
      { id: 's2', start: '2026-09-15', end: '2026-09-30' },
      { id: 's3', start: '2026-10-01', end: '2026-10-14' },
    ])
  })
  it('a new start ends the sprint before it the day before', () => {
    expect(rescheduleSprint(sprints, 1, { start: '2026-09-17' })).toEqual([
      { id: 's1', start: '2026-09-01', end: '2026-09-16' },
      { id: 's2', start: '2026-09-17', end: '2026-09-28' },
    ])
  })
  it('keeps sprints at least a week long', () => {
    expect(rescheduleSprint(sprints, 0, { end: '2026-09-03' })[0]).toEqual({
      id: 's1',
      start: '2026-09-01',
      end: '2026-09-07',
    })
    expect(earliestSprintDate(sprints, 1, 'start')).toBe('2026-09-08')
    expect(earliestSprintDate(sprints, 1, 'end')).toBe('2026-09-21')
  })
})
