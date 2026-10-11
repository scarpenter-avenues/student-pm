// Tests for the Timeline's layout arithmetic (a task's span, bar widths, lanes) and for what dragging a bar does
// to its dates.
import { describe, expect, it } from 'vitest'
import { dateSpan, overflowDays, packLanes, dragDates } from '../timeline'

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

describe('dragging a bar', () => {
  const both = { start: '2026-10-05', due: '2026-10-09' }
  it('the middle moves both dates', () => {
    expect(dragDates(both, 'move', 3)).toEqual({ start: '2026-10-08', due: '2026-10-12' })
    expect(dragDates(both, 'move', -5)).toEqual({ start: '2026-09-30', due: '2026-10-04' })
  })
  it('a task with one date keeps having one when moved', () => {
    expect(dragDates({ start: null, due: '2026-10-09' }, 'move', 2)).toEqual({
      start: null,
      due: '2026-10-11',
    })
  })
  it('an end changes only that date', () => {
    expect(dragDates(both, 'start', -2)).toEqual({ start: '2026-10-03', due: '2026-10-09' })
    expect(dragDates(both, 'end', 4)).toEqual({ start: '2026-10-05', due: '2026-10-13' })
  })
  it("an end can't cross the other one", () => {
    expect(dragDates(both, 'start', 10)).toEqual({ start: '2026-10-09', due: '2026-10-09' })
    expect(dragDates(both, 'end', -10)).toEqual({ start: '2026-10-05', due: '2026-10-05' })
  })
  it('pulling an end of a one-date task fills in the other date', () => {
    expect(dragDates({ start: null, due: '2026-10-09' }, 'start', -3)).toEqual({
      start: '2026-10-06',
      due: '2026-10-09',
    })
    expect(dragDates({ start: '2026-10-05', due: null }, 'end', 2)).toEqual({
      start: '2026-10-05',
      due: '2026-10-07',
    })
  })
  it('no movement changes nothing', () => {
    expect(dragDates({ start: null, due: '2026-10-09' }, 'end', 0)).toEqual({
      start: null,
      due: '2026-10-09',
    })
  })
})
