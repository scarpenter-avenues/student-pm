import { describe, expect, it } from 'vitest'
import { DEFAULT_HUDDLE_PLAN, cleanPlan, defaultHuddlePlan } from '../huddles'

describe('huddle plans', () => {
  it("uses the program's default plan, else the built-in one, as fresh copies", () => {
    const own = [{ time: '16:00', text: 'Build', audience: ['all'], runBy: 'coach-rivera' }]
    expect(defaultHuddlePlan({ huddlePlan: own })).toEqual(own)
    const builtIn = defaultHuddlePlan(null)
    expect(builtIn).toEqual(DEFAULT_HUDDLE_PLAN)
    expect(builtIn.every((row) => row.audience.join() === 'all')).toBe(true)
    builtIn[0]!.audience.push('adults')
    expect(DEFAULT_HUDDLE_PLAN[0]!.audience).toEqual(['all'])
  })
  it('drops empty rows, trims, sorts by time, and leaves out an empty run-by', () => {
    expect(
      cleanPlan([
        { time: '17:00', text: ' Pack up ', audience: ['all'] },
        { time: '15:30', text: '   ', audience: ['all'] },
        { time: '15:45', text: 'Safety check', audience: ['adults'], runBy: 'ms-patel' },
      ]),
    ).toEqual([
      { time: '15:45', text: 'Safety check', audience: ['adults'], runBy: 'ms-patel' },
      { time: '17:00', text: 'Pack up', audience: ['all'] },
    ])
  })
})
