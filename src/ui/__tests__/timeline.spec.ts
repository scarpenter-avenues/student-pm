import { describe, expect, it } from 'vitest'
import { dateSpan, overflowDays, packLanes } from '../timeline'

describe('timeline layout', () => {
  it('spans from either date', () => {
    expect(dateSpan({ start: '2026-10-02', due: '2026-10-05' })).toEqual([
      '2026-10-02',
      '2026-10-05',
    ])
    expect(dateSpan({ start: null, due: '2026-10-05' })).toEqual(['2026-10-05', '2026-10-05'])
    expect(dateSpan({ start: '2026-10-09', due: '2026-10-05' })).toEqual([
      '2026-10-05',
      '2026-10-09',
    ])
    expect(dateSpan({ start: null, due: null })).toBeNull()
  })
  it('packs bars into the fewest lanes without overlap', () => {
    const { lanes, count } = packLanes([
      { packStart: '2026-10-02', packEnd: '2026-10-05' },
      { packStart: '2026-10-03', packEnd: '2026-10-04' },
      { packStart: '2026-10-06', packEnd: '2026-10-08' },
    ])
    expect(lanes).toEqual([0, 1, 0])
    expect(count).toBe(2)
  })
  it('turns overflow pixels into days', () => {
    expect(overflowDays(0, 44)).toBe(0)
    expect(overflowDays(30, 44)).toBe(1)
    expect(overflowDays(90, 44)).toBe(3)
  })
})
