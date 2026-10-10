import { describe, expect, it } from 'vitest'
import { checkRows, parseCsv, shortName } from '../csv'

const teams = [
  {
    id: 'cb',
    name: 'Circuit Breakers',
    number: '418',
    subteams: [{ id: 'mech', name: 'Mechanical', color: 'red' as const, description: '' }],
  },
]
const auth = { google: { domains: ['example.edu'] }, password: { roles: ['mentor' as const] } }

describe('CSV import', () => {
  it('parses quotes, commas inside quotes, and CRLF; drops blank rows', () => {
    expect(
      parseCsv('Name,Email\r\n"Kim, Avery",a@example.edu\r\n\r\n"Say ""hi""",b@example.edu'),
    ).toEqual([
      ['Name', 'Email'],
      ['Kim, Avery', 'a@example.edu'],
      ['Say "hi"', 'b@example.edu'],
    ])
  })
  it('shortens last names to an initial', () => {
    expect(shortName('Avery Kim')).toBe('Avery K.')
    expect(shortName('Avery K.')).toBe('Avery K.')
    expect(shortName('Mina')).toBe('Mina')
  })
  it('checks each row: team by name or number, subteams, sign-in, duplicates', () => {
    const rows = parseCsv(
      [
        'Name,Email,Role,Subteams,Team',
        'Avery Kim,avery@example.edu,Student,Mechanical;Cooking,418',
        'Okafor,okafor@gmail.com,Team mentor,,Circuit Breakers',
        'Kid,kid@gmail.com,Student,,',
        'Twice,avery@example.edu,,,',
        'Ghost,ghost@example.edu,Wizard,,',
        'Lost,lost@example.edu,Student,,Nowhere',
        'Sam R.,sam@example.edu,,,',
      ].join('\n'),
    )
    const result = checkRows(rows, {
      teams,
      defaultTeamId: null,
      existingNames: ['Sam R.'],
      existingEmails: [],
      auth,
    })
    expect(result[0]).toMatchObject({
      name: 'Avery K.',
      role: 'student',
      teamId: 'cb',
      subteamIds: ['mech'],
      error: '',
    })
    expect(result[0]!.notes.join(' ')).toContain('Cooking')
    expect(result[1]).toMatchObject({ role: 'mentor', teamId: 'cb', error: '' })
    expect(result.slice(2).map((r) => r.error)).toEqual([
      "This email can't sign in to the program",
      'Listed twice in this file',
      'Unknown role “Wizard”',
      'Unknown team “Nowhere”',
      'Already in the program',
    ])
  })
})
