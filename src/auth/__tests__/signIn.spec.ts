import { describe, expect, it } from 'vitest'
import { signInMethodFor } from '@/model/signIn'
import { authMessage } from '../messages'

describe('sign-in method', () => {
  const both = { google: { domains: ['example.edu'] }, password: { roles: ['mentor' as const] } }
  it('school emails use Google; others a password if their role allows it', () => {
    expect(signInMethodFor(both, 'Avery.K@Example.edu', 'student')).toBe('google')
    expect(signInMethodFor(both, 'okafor@gmail.com', 'mentor')).toBe('password')
    expect(signInMethodFor(both, 'kid@gmail.com', 'student')).toBeNull()
    expect(signInMethodFor({ password: { roles: ['student'] } }, 'a@b.org', 'student')).toBe(
      'password',
    )
  })
})

describe('auth messages', () => {
  it('explains errors in plain words and stays quiet when the person closes the pop-up', () => {
    expect(authMessage({ code: 'auth/invalid-credential' })).toMatch(/don't match/)
    expect(authMessage({ code: 'auth/popup-closed-by-user' })).toBeNull()
    expect(authMessage(new Error('?'))).toMatch(/Something went wrong/)
  })
})
