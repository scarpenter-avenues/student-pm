import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

// The routes import the session store, which talks to Firebase.
vi.mock('@/firebase', () => ({ auth: {}, db: {}, programId: 'p1', usingEmulators: false }))

import { routes } from '../index'
import { decide, type Access } from '../access'

const router = createRouter({ history: createMemoryHistory(), routes })
const at = (path: string) => router.resolve(path) as Parameters<typeof decide>[0]

const student: Access = { phase: 'ready', member: { role: 'student', teamIds: ['cb'] } }
const mentor: Access = { phase: 'ready', member: { role: 'mentor', teamIds: ['cb', 'gg'] } }
const coach: Access = { phase: 'ready', member: { role: 'coach', teamIds: [] } }
const noTeam: Access = { phase: 'ready', member: { role: 'student', teamIds: [] } }
const signedOut: Access = { phase: 'signedOut', member: null }

describe('route access', () => {
  it('sends signed-out people to sign in, remembering where they were going', () => {
    expect(decide(at('/t/cb/board'), signedOut)).toEqual({
      name: 'sign-in',
      query: { next: '/t/cb/board' },
    })
    expect(decide(at('/'), signedOut)).toEqual({ name: 'sign-in' })
    expect(decide(at('/sign-in'), signedOut)).toBe(true)
  })
  it('sends people home after signing in, or back where they were going', () => {
    expect(decide(at('/sign-in'), student)).toEqual({
      name: 'team',
      params: { teamId: 'cb', tab: 'board' },
    })
    expect(decide(at('/sign-in?next=/t/cb/goals'), student)).toBe('/t/cb/goals')
    // Only paths inside the app.
    expect(decide(at('/sign-in?next=https://example.com'), student)).toEqual({
      name: 'team',
      params: { teamId: 'cb', tab: 'board' },
    })
  })
  it('lands program coaches on the Huddle, others on their team, and the teamless on No team', () => {
    expect(decide(at('/'), coach)).toEqual({ name: 'dashboard', params: { tab: 'huddle' } })
    expect(decide(at('/'), student)).toEqual({
      name: 'team',
      params: { teamId: 'cb', tab: 'board' },
    })
    expect(decide(at('/'), noTeam)).toEqual({ name: 'no-team' })
    expect(decide(at('/no-team'), noTeam)).toBe(true)
    expect(decide(at('/no-team'), student)).not.toBe(true)
  })
  it("keeps everyone but program coaches off the Coaches' Dashboard", () => {
    expect(decide(at('/dashboard/goals'), coach)).toBe(true)
    expect(decide(at('/dashboard/goals'), mentor)).not.toBe(true)
    expect(decide(at('/dashboard/goals'), student)).not.toBe(true)
  })
  it('opens only your own teams (program coaches: any team)', () => {
    expect(decide(at('/t/cb/list'), student)).toBe(true)
    expect(decide(at('/t/gg/list'), student)).not.toBe(true)
    expect(decide(at('/t/gg/list'), mentor)).toBe(true)
    expect(decide(at('/t/gg/list'), coach)).toBe(true)
    expect(decide(at('/t/gg/announcements'), student)).not.toBe(true)
  })
  it('shows the Huddle page to mentors only; program coaches read it on the dashboard', () => {
    expect(decide(at('/huddle'), mentor)).toBe(true)
    expect(decide(at('/huddle'), student)).not.toBe(true)
    expect(decide(at('/huddle'), coach)).toEqual({ name: 'dashboard', params: { tab: 'huddle' } })
  })
})
