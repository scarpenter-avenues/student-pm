import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkConfig, signInMethodFor, slugify } from '../config'

const example = () => JSON.parse(readFileSync('program.config.example.json', 'utf8'))

describe('checkConfig', () => {
  it('accepts the example config', () => {
    expect(checkConfig(example())).toEqual([])
  })
  it('needs at least one sign-in method', () => {
    const config = example()
    config.signIn = {}
    expect(checkConfig(config).join()).toContain('turn on "google", "password", or both')
  })
  it("catches a first coach who couldn't sign in", () => {
    const config = example()
    config.firstCoach.email = 'coach@gmail.com'
    config.signIn = { google: { allowedDomains: ['example.edu'] } }
    expect(checkConfig(config).join()).toContain("firstCoach.email can't sign in")
  })
  it('checks dates, colors, and duplicate teams', () => {
    const config = example()
    config.season.end = '2026-01-01'
    config.subteamDefaults[0].color = 'magenta'
    config.teams = [{ name: 'Bots' }, { name: 'bots' }]
    const problems = checkConfig(config).join('\n')
    expect(problems).toContain('season.end must be after season.start')
    expect(problems).toContain('subteamDefaults[0].color')
    expect(problems).toContain('two teams have the same name')
  })
  it('reports every problem in an empty config', () => {
    expect(checkConfig({}).length).toBeGreaterThan(5)
  })
})

describe('signInMethodFor', () => {
  const config = {
    signIn: {
      google: { allowedDomains: ['example.edu'] },
      password: { roles: ['mentor', 'coach'] as ('mentor' | 'coach')[] },
    },
  }
  it('matches the security rules', () => {
    expect(signInMethodFor(config, 'kid@example.edu', 'student')).toBe('google')
    expect(signInMethodFor(config, 'teacher@example.edu', 'mentor')).toBe('google')
    expect(signInMethodFor(config, 'volunteer@gmail.com', 'mentor')).toBe('password')
    expect(signInMethodFor(config, 'kid@gmail.com', 'student')).toBeNull()
  })
})

describe('slugify', () => {
  it('makes document ids from names', () => {
    expect(slugify('Circuit Breakers')).toBe('circuit-breakers')
    expect(slugify('  Bolt   Brigade! ')).toBe('bolt-brigade')
  })
})
