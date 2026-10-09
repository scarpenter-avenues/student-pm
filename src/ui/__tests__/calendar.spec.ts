import { describe, expect, it } from 'vitest'
import { calendarMonth, moveDay, shiftMonth } from '../calendar'
import { formatShortDate } from '../format'

describe('calendar', () => {
  it('lays out a month starting on Sunday', () => {
    const october = calendarMonth('2026-10')
    expect(october.title).toBe('October 2026')
    expect(october.leading).toBe(4) // Oct 1, 2026 is a Thursday
    expect(october.days).toHaveLength(31)
    expect(calendarMonth('2028-02').days).toHaveLength(29)
  })
  it('pages months across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
  it('arrow keys move by a day or a week', () => {
    expect(moveDay('2026-10-31', 'ArrowRight')).toBe('2026-11-01')
    expect(moveDay('2026-10-03', 'ArrowUp')).toBe('2026-09-26')
    expect(moveDay('2026-10-03', 'Enter')).toBeNull()
  })
  it('formats short dates', () => {
    expect(formatShortDate('2026-10-06')).toBe('Oct 6')
    expect(formatShortDate(null)).toBe('—')
  })
})
