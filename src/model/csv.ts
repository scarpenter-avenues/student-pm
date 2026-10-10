// Importing people from a CSV (Program settings → People): five columns, Name · Email · Role · Subteams · Team.
// Only these columns are read; anything else (phone numbers, birthdays…) is dropped and never saved.
import { signInMethodFor } from './signIn'
import { ROLES, ROLE_LABELS, type ProgramAuth, type Role, type Subteam } from './types'

export const CSV_TEMPLATE = `Name,Email,Role,Subteams,Team
Avery K.,avery.k@example.edu,Student,Mechanical;Software,Circuit Breakers
Jordan M.,jordan.m@example.edu,Team lead,Mechanical,418
Ms. Patel,ms.patel@example.edu,Team mentor,,Circuit Breakers
`

/** RFC 4180-ish: quoted fields, doubled quotes, CRLF or LF. Blank rows are dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
    .map((cells) => cells.map((cell) => cell.trim()))
    .filter((cells) => cells.some(Boolean))
}

export interface ImportTeam {
  id: string
  name: string
  number: string
  subteams: readonly Subteam[]
}
export interface Candidate {
  name: string
  email: string
  role: Role | null
  teamId: string | null
  subteamIds: string[]
  error: string
  notes: string[]
}

/** "Avery Kim" → "Avery K." (first name and last initial). */
export function shortName(raw: string): string {
  const name = raw.replace(/[|]/g, '').replace(/\s+/g, ' ').trim()
  const parts = name.split(' ')
  const last = parts.at(-1) ?? ''
  return parts.length > 1 && last.replace('.', '').length > 1
    ? `${parts.slice(0, -1).join(' ')} ${last[0]!.toUpperCase()}.`
    : name
}

export function checkRows(
  rows: string[][],
  options: {
    teams: readonly ImportTeam[]
    defaultTeamId: string | null
    existingNames: readonly string[]
    existingEmails: readonly string[]
    auth: ProgramAuth | null
  },
): Candidate[] {
  const first = (rows[0]?.[0] ?? '').toLowerCase()
  const body = /name/.test(first) && !(rows[0]?.[1] ?? '').includes('@') ? rows.slice(1) : rows
  const seen = new Set<string>()
  const names = new Set(options.existingNames.map((n) => n.toLowerCase()))
  const emails = new Set(options.existingEmails.map((e) => e.toLowerCase()))
  return body.map(([rawName = '', rawEmail = '', rawRole = '', rawSubteams = '', rawTeam = '']) => {
    const notes: string[] = []
    const name = shortName(rawName)
    if (name && name !== rawName.replace(/\s+/g, ' ').trim()) notes.push(`Shortened to ${name}`)
    const email = rawEmail.trim().toLowerCase()
    const role = rawRole
      ? (ROLES.find(
          (r) =>
            ROLE_LABELS[r].toLowerCase() === rawRole.toLowerCase() || r === rawRole.toLowerCase(),
        ) ?? null)
      : 'student'
    const teamText = rawTeam.trim().toLowerCase()
    const named = teamText
      ? (options.teams.find((t) => t.name.toLowerCase() === teamText || t.number === teamText) ??
        null)
      : null
    const teamId = role === 'coach' ? null : teamText ? (named?.id ?? null) : options.defaultTeamId
    const team = options.teams.find((t) => t.id === teamId)
    const wanted = rawSubteams
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const known = team?.subteams ?? []
    const matched = wanted.flatMap((w) =>
      known.filter((s) => s.name.toLowerCase() === w.toLowerCase()).map((s) => s.id),
    )
    const unknown = wanted.filter(
      (w) => !known.some((s) => s.name.toLowerCase() === w.toLowerCase()),
    )
    if (unknown.length)
      notes.push(`Unknown subteam${unknown.length > 1 ? 's' : ''} skipped: ${unknown.join(', ')}`)
    let error = ''
    if (!name) error = 'Missing name'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      error = email ? 'Not a valid email' : 'Missing email'
    else if (!role) error = `Unknown role “${rawRole}”`
    else if (teamText && !named && role !== 'coach') error = `Unknown team “${rawTeam.trim()}”`
    else if (options.auth && !signInMethodFor(options.auth, email, role))
      error = "This email can't sign in to the program"
    else if (emails.has(email) || names.has(name.toLowerCase())) error = 'Already in the program'
    else if (seen.has(email) || seen.has(name.toLowerCase())) error = 'Listed twice in this file'
    seen.add(email)
    seen.add(name.toLowerCase())
    return { name, email, role, teamId, subteamIds: [...new Set(matched)], error, notes }
  })
}
