import { describe, expect, it } from 'vitest'
import { initials } from '../format'
import { mixHex, teamAccent, teamColorOf } from '../teamColor'

describe('initials', () => {
  it('takes the first letter of each word', () => {
    expect(initials('Avery K.')).toBe('AK')
    expect(initials('Coach Rivera')).toBe('CR')
    expect(initials('')).toBe('')
  })
})

describe('team colors', () => {
  it('uses presets, custom colors, and falls back to green', () => {
    expect(teamColorOf('navy')).toEqual({ bg: '#27406b', fg: '#ffffff' })
    expect(teamColorOf('#102030').fg).toBe('#ffffff')
    expect(teamColorOf('#f0f0a0').fg).not.toBe('#ffffff')
    expect(teamColorOf('nonsense')).toEqual(teamColorOf('green'))
  })
  it('mixes colors', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
  it('keeps dark team colors as the ink and darkens light ones', () => {
    expect(teamAccent('navy')['--team-ink']).toBe('#27406b')
    expect(teamAccent('yellow')['--team-ink']).not.toBe('#f2d36b')
  })
})
