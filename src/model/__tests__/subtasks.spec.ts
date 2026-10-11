// Tests for where a dragged subtask lands among its siblings.
import { describe, expect, it } from 'vitest'
import { placeSubtask } from '../subtasks'
import type { Subtask } from '../types'

const list = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id }) as Subtask)
const order = (items: Subtask[]) => items.map((item) => item.id).join('')

describe('placing a dragged subtask', () => {
  it('goes between its new neighbors', () => {
    expect(order(placeSubtask(list, 'd', 'a', 'b'))).toBe('adbc')
    expect(order(placeSubtask(list, 'a', 'c', 'd'))).toBe('bcad')
  })
  it('goes to the start or the end', () => {
    expect(order(placeSubtask(list, 'c', null, 'a'))).toBe('cabd')
    expect(order(placeSubtask(list, 'b', 'd', null))).toBe('acdb')
  })
  it('keeps hidden (archived) subtasks where they are relative to the rest', () => {
    // "b" is archived, so the drop only knows a, c, d: c dragged to the top.
    expect(order(placeSubtask(list, 'c', null, 'a'))).toBe('cabd')
  })
  it("changes nothing for a subtask that isn't there", () => {
    expect(order(placeSubtask(list, 'x', 'a', 'b'))).toBe('abcd')
  })
})
