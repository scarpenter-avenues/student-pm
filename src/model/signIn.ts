// Which sign-in method a person uses. Mirrors signInAllowed() in firestore.rules: emails on the program's Google
// domains must use Google; other emails may use email/password if the program allows it for their role.
import type { ProgramAuth, Role } from './types'

export type SignInMethod = 'google' | 'password'

/** The part of an email after the @, in lower case ("Avery@Example.edu" → "example.edu"). */
export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? ''
}

/**
 * Whether this email is on one of the program's Google domains, which means it must sign in with Google.
 */
export function isGoogleEmail(auth: ProgramAuth, email: string): boolean {
  return !!auth.google?.domains.some((domain) => domain.toLowerCase() === emailDomain(email))
}

/** How someone with this email and role signs in, or null if they can't. */
export function signInMethodFor(auth: ProgramAuth, email: string, role: Role): SignInMethod | null {
  if (isGoogleEmail(auth, email)) return 'google'
  if (auth.password?.roles.includes(role)) return 'password'
  return null
}
