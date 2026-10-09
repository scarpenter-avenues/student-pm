// Route guards, as a pure function of the route and the session so they're easy to test. The security rules are what
// actually protect the data; these just keep people on pages they can use.
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { ADULT_ROLES, type Member } from '@/model/types'
import type { Phase } from '@/stores/session'
import { DEFAULT_TEAM_TAB } from './tabs'

declare module 'vue-router' {
  interface RouteMeta {
    /** Open without signing in (the sign-in page). */
    public?: boolean
    /** Dev-only pages: open to anyone, signed in or not. */
    dev?: boolean
    coachOnly?: boolean
    adultOnly?: boolean
  }
}

export interface Access {
  phase: Phase
  member: Pick<Member, 'role' | 'teamIds'> | null
}

/** Where someone lands: program coaches on the Coaches' Dashboard, everyone else on their (first) team. */
export function homeFor(member: Access['member']): RouteLocationRaw {
  if (member?.role === 'coach') return { name: 'dashboard', params: { tab: 'huddle' } }
  const teamId = member?.teamIds[0]
  if (teamId) return { name: 'team', params: { teamId, tab: DEFAULT_TEAM_TAB } }
  return { name: 'no-team' }
}

/** true to allow the route, or where to go instead. */
export function decide(
  to: RouteLocationNormalized,
  { phase, member }: Access,
): true | RouteLocationRaw {
  if (to.meta.dev) return true
  if (to.meta.public) {
    if (phase !== 'ready') return true
    const next =
      typeof to.query.next === 'string' && to.query.next.startsWith('/') ? to.query.next : null
    return next ?? homeFor(member)
  }
  if (phase !== 'ready' || !member) {
    return to.fullPath === '/'
      ? { name: 'sign-in' }
      : { name: 'sign-in', query: { next: to.fullPath } }
  }
  const isCoach = member.role === 'coach'
  if (to.name === 'home') return homeFor(member)
  // Program coaches read huddles on their dashboard.
  if (to.name === 'huddle' && isCoach) return { name: 'dashboard', params: { tab: 'huddle' } }
  if (to.name === 'no-team' && (isCoach || member.teamIds.length)) return homeFor(member)
  if (to.meta.coachOnly && !isCoach) return homeFor(member)
  if (to.meta.adultOnly && !ADULT_ROLES.includes(member.role)) return homeFor(member)
  const teamId = to.params.teamId
  if (typeof teamId === 'string' && !isCoach && !member.teamIds.includes(teamId)) {
    return homeFor(member)
  }
  return true
}
