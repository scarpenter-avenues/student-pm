// Reads and checks program.config.json (see docs/configuration.md). Problems are reported all at once, in plain words.
import { readFileSync } from 'node:fs'
import { signInMethodFor as methodFor, type SignInMethod } from '../../src/model/signIn'
import {
  ROLES,
  SUBTEAM_COLORS,
  TEAM_COLOR_PRESETS,
  type ProgramAuth,
  type Role,
  type SubteamColor,
} from '../../src/model/types'

export interface ProgramConfig {
  program: { id: string; name: string }
  signIn: { google?: { allowedDomains: string[] }; password?: { roles: Role[] } }
  firstCoach: { displayName: string; email: string }
  season: { id: string; name: string; start: string; end: string }
  subteamDefaults: { name: string; color: SubteamColor; description: string }[]
  teams: { name: string; number?: string; color?: string; sprintDays?: number }[]
}

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
const isEmail = (value: unknown): value is string =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const isId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,62}$/.test(value)
const isDomain = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)

// Untyped JSON, read safely.
type Raw = Record<string, unknown>
const obj = (value: unknown): Raw =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {}
const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/** Returns a list of problems; empty means the config is usable. */
export function checkConfig(raw: unknown): string[] {
  const problems: string[] = []
  const c = obj(raw)
  const program = obj(c.program)
  if (!isId(program.id))
    problems.push(
      'program.id: use lowercase letters, numbers, and dashes (e.g. "example-robotics").',
    )
  if (!str(program.name)) problems.push('program.name is missing.')

  const signIn = obj(c.signIn)
  const google = signIn.google === undefined ? undefined : obj(signIn.google)
  const password = signIn.password === undefined ? undefined : obj(signIn.password)
  if (!google && !password) problems.push('signIn: turn on "google", "password", or both.')
  const domains = list(google?.allowedDomains)
  if (google && (!domains.length || !domains.every(isDomain))) {
    problems.push(
      'signIn.google.allowedDomains: list your Workspace domain(s), e.g. ["example.edu"].',
    )
  }
  const roles = list(password?.roles)
  if (password && (!roles.length || !roles.every((role) => ROLES.includes(role as Role)))) {
    problems.push(
      `signIn.password.roles: list who may use email/password, from ${ROLES.join(', ')}.`,
    )
  }

  const coach = obj(c.firstCoach)
  if (!str(coach.displayName))
    problems.push('firstCoach.displayName is missing (first name and last initial).')
  if (!isEmail(coach.email)) problems.push('firstCoach.email is not a valid email.')
  else if (
    !problems.some((p) => p.startsWith('signIn')) &&
    !signInMethodFor(c as unknown as ProgramConfig, coach.email.toLowerCase(), 'coach')
  ) {
    problems.push(
      `firstCoach.email can't sign in with these signIn settings: use an address on ${domains.join(' or ') || 'an allowed domain'}, or allow "coach" under signIn.password.roles.`,
    )
  }

  const season = obj(c.season)
  if (!isId(season.id))
    problems.push('season.id: use lowercase letters, numbers, and dashes (e.g. "2026-27").')
  if (!str(season.name)) problems.push('season.name is missing (e.g. "2026–27").')
  if (!isDate(season.start) || !isDate(season.end))
    problems.push('season.start and season.end must be dates like "2026-09-01".')
  else if (season.end <= season.start) problems.push('season.end must be after season.start.')

  if (!Array.isArray(c.subteamDefaults))
    problems.push('subteamDefaults must be a list (it can be empty).')
  else
    c.subteamDefaults.forEach((entry, i) => {
      const subteam = obj(entry)
      if (!str(subteam.name)) problems.push(`subteamDefaults[${i}].name is missing.`)
      if (!SUBTEAM_COLORS.includes(subteam.color as SubteamColor))
        problems.push(`subteamDefaults[${i}].color: use one of ${SUBTEAM_COLORS.join(', ')}.`)
    })

  if (c.teams !== undefined && !Array.isArray(c.teams))
    problems.push('teams must be a list (or left out).')
  const teams = list(c.teams).map(obj)
  teams.forEach((team, i) => {
    if (!str(team.name)) problems.push(`teams[${i}].name is missing.`)
    const color = str(team.color)
    if (
      color &&
      !(TEAM_COLOR_PRESETS as readonly string[]).includes(color) &&
      !/^#[0-9a-f]{6}$/i.test(color)
    ) {
      problems.push(
        `teams[${i}].color: use a preset (${TEAM_COLOR_PRESETS.join(', ')}) or "#rrggbb".`,
      )
    }
    const days = team.sprintDays
    if (
      days !== undefined &&
      (typeof days !== 'number' || !Number.isInteger(days) || days < 5 || days > 28)
    ) {
      problems.push(`teams[${i}].sprintDays: a whole number of days from 5 to 28.`)
    }
  })
  const names = teams.map((team) => str(team.name).toLowerCase())
  if (new Set(names).size !== names.length) problems.push('teams: two teams have the same name.')
  return problems
}

/** The program's sign-in settings as stored in Firestore (programs/{p}.auth). */
export function programAuthFrom(config: Pick<ProgramConfig, 'signIn'>): ProgramAuth {
  const { google, password } = config.signIn
  return {
    ...(google ? { google: { domains: google.allowedDomains.map((d) => d.toLowerCase()) } } : {}),
    ...(password ? { password: { roles: password.roles } } : {}),
  }
}

/** How someone with this email and role signs in under the config, or null if they can't. Mirrors the security rules. */
export function signInMethodFor(
  config: Pick<ProgramConfig, 'signIn'>,
  email: string,
  role: Role,
): SignInMethod | null {
  return methodFor(programAuthFrom(config), email, role)
}

export function loadConfig(path: string): ProgramConfig {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(
      `Couldn't read ${path}: ${(error as Error).message}\nCopy program.config.example.json to ${path} and edit it.`,
    )
  }
  const problems = checkConfig(raw)
  if (problems.length)
    throw new Error(`${path} needs fixing:\n${problems.map((p) => `  • ${p}`).join('\n')}`)
  return raw as ProgramConfig
}

export { slugify } from '../../src/model/slug'
