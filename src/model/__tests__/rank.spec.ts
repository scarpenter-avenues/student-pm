import { describe, expect, it } from 'vitest'
import { byRank, rankAt, rankBetween, rankForMove, ranksFor } from '../rank'
import { addSubtask, moveSubtask, updateSubtask } from '../subtasks'

describe('ranks (order is priority)', () => {
  const ranks = ranksFor(4)
  it('makes ordered keys', () => {
    expect([...ranks].sort()).toEqual(ranks)
    expect(new Set(ranks).size).toBe(4)
  })
  it('adds to the top or bottom', () => {
    expect(rankAt(ranks, 'top') < ranks[0]!).toBe(true)
    expect(rankAt(ranks, 'bottom') > ranks[3]!).toBe(true)
    expect(rankAt([], 'top')).toBe(rankBetween(null, null))
  })
  it('moves an item to any position', () => {
    const order = (from: number, to: number) => {
      const items = ranks.map((rank, i) => ({ id: `t${i}`, rank }))
      items[from]!.rank = rankForMove(ranks, from, to)
      return items.sort(byRank).map((item) => item.id)
    }
    expect(order(3, 0)).toEqual(['t3', 't0', 't1', 't2']) // move to top
    expect(order(0, 3)).toEqual(['t1', 't2', 't3', 't0']) // move to bottom
    expect(order(1, 2)).toEqual(['t0', 't2', 't1', 't3']) // down one
    expect(order(2, 1)).toEqual(['t0', 't2', 't1', 't3']) // up one
  })
  it('survives a tie from simultaneous adds; the id breaks it', () => {
    expect(rankBetween('a1', 'a1')).toBe('a1')
    expect(
      [
        { id: 'b', rank: 'a1' },
        { id: 'a', rank: 'a1' },
      ].sort(byRank)[0]!.id,
    ).toBe('a')
  })
})

describe('subtasks', () => {
  it('adds with defaults, updates, and reorders', () => {
    let list = addSubtask([], { title: 'Cut plate' })
    list = addSubtask(list, { title: 'Drill holes', subteamIds: ['mech'] })
    expect(list[0]).toMatchObject({ title: 'Cut plate', status: 'To do', archived: null })
    expect(list[0]!.id).not.toBe(list[1]!.id)
    list = updateSubtask(list, list[1]!.id, { status: 'Done' })
    expect(list[1]!.status).toBe('Done')
    expect(moveSubtask(list, 1, 0).map((s) => s.title)).toEqual(['Drill holes', 'Cut plate'])
  })
})
