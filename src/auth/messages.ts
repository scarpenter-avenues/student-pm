// Plain-language messages for Firebase Auth errors on the sign-in page.

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': "That email and password don't match.",
  'auth/wrong-password': "That email and password don't match.",
  'auth/user-not-found': "That email and password don't match.",
  'auth/invalid-email': "That doesn't look like an email address.",
  'auth/missing-password': 'Enter your password.',
  'auth/weak-password': 'Use at least 8 characters.',
  'auth/email-already-in-use':
    'There’s already an account for this email. Sign in instead, or reset your password.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes, then try again.',
  'auth/network-request-failed': "Can't reach the server. Check your connection and try again.",
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site.',
  'auth/user-disabled': 'This account has been turned off. Ask your coach.',
  'auth/operation-not-allowed': "This sign-in method isn't turned on for this app.",
}

/** Errors that mean the person changed their mind, not that something went wrong. */
const QUIET = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])

export function authMessage(error: unknown): string | null {
  const code = (error as { code?: string } | null)?.code ?? ''
  if (QUIET.has(code)) return null
  return MESSAGES[code] ?? 'Something went wrong signing in. Try again.'
}
