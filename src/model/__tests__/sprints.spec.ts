import { describe, expect, it } from 'vitest'
import { buildSprints, sprintIndexOn } from '../sprints'
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
