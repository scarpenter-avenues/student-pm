import { describe, expect, it } from 'vitest'
import {
  announcementMessage,
  announcementRecipients,
  huddleMessage,
  huddleRecipients,
  type Context,
  type Person,
} from '../messages'
import { clock, htmlToText } from '../text'

const people: Person[] = [
  { id: 'coach', displayName: 'Coach Rivera', role: 'coach', teamIds: [] },
  { id: 'mentorA', displayName: 'Ms. Patel', role: 'mentor', teamIds: ['a'] },
  { id: 'mentorAB', displayName: 'Mr. Okafor', role: 'mentor', teamIds: ['a', 'b'] },
  { id: 'leadA', displayName: 'Jordan M.', role: 'lead', teamIds: ['a'] },
  { id: 'studentA', displayName: 'Avery K.', role: 'student', teamIds: ['a'] },
  { id: 'studentB', displayName: 'Sam R.', role: 'student', teamIds: ['b'] },
  { id: 'noTeam', displayName: 'Mina L.', role: 'student', teamIds: [] },
]
const context: Context = {
  programName: 'Example Robotics',
  appUrl: 'https://example.web.app',
  people,
  teamNames: { a: 'Circuit Breakers', b: 'Gear Grinders' },
}
const ids = (list: Person[]) => list.map((person) => person.id).sort()

describe('who gets an email', () => {
  it("a team's announcement goes to that team and every program coach, not its author or other teams", () => {
    const post = { audience: ['a'], authorId: 'leadA' }
    expect(ids(announcementRecipients(post, people))).toEqual([
      'coach',
      'mentorA',
      'mentorAB',
      'studentA',
    ])
  })
  it('a program-wide announcement goes to everyone but its author', () => {
    const post = { audience: ['all'], authorId: 'coach' }
    expect(ids(announcementRecipients(post, people))).toEqual(
      ['leadA', 'mentorA', 'mentorAB', 'noTeam', 'studentA', 'studentB'].sort(),
    )
  })
  it('a mentor on two of the teams is emailed once', () => {
    const to = announcementRecipients({ audience: ['a', 'b'], authorId: 'coach' }, people)
    expect(to.filter((person) => person.id === 'mentorAB')).toHaveLength(1)
  })
  it('with students left out, only mentors and coaches are emailed', () => {
    const post = { audience: ['all'], authorId: 'mentorA' }
    expect(ids(announcementRecipients(post, people, { includeStudents: false }))).toEqual([
      'coach',
      'mentorAB',
    ])
  })
  it('huddles go to coaches and mentors only, never students', () => {
    expect(ids(huddleRecipients({ authorId: 'coach' }, people))).toEqual(['mentorA', 'mentorAB'])
  })
})

describe('what an email says', () => {
  it('an announcement: who posted it, to whom, the text, and a link', () => {
    const message = announcementMessage(
      {
        title: 'Saturday practice',
        bodyHtml:
          '<p>Field is open <strong>10 to noon</strong>.</p><ul><li>Bring notebooks</li></ul>',
        body: '',
        audience: ['a'],
        authorId: 'mentorA',
      },
      context,
    )
    expect(message.subject).toBe('Example Robotics: Saturday practice')
    expect(message.text).toContain('Ms. Patel posted to Circuit Breakers:')
    expect(message.text).toContain('Field is open 10 to noon.\n• Bring notebooks')
    expect(message.text).toContain('https://example.web.app')
  })
  it('stored HTML never reaches the email as HTML', () => {
    const message = announcementMessage(
      {
        title: '<img src=x onerror=alert(1)>',
        bodyHtml: '<p>Hi</p><script>alert(1)</script><a href="https://evil.example">click</a>',
        body: '',
        audience: ['all'],
        authorId: 'coach',
      },
      context,
    )
    expect(message.html).not.toMatch(/<script|<img|evil\.example"/)
    expect(message.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
  it('a huddle: status, the plan with times, who runs it and who it is for, and heads-ups', () => {
    const message = huddleMessage(
      {
        kind: 'huddle',
        date: '2026-10-10',
        authorId: 'coach',
        statusHtml:
          '<p>Check in with <span data-type="mention" data-id="member:studentA">Avery K.</span>.</p>',
        plan: [
          { time: '15:30', text: 'Safety check', audience: ['all'] },
          { time: '16:00', text: 'Field time', audience: ['a', 'adults'], runBy: 'mentorA' },
        ],
        notes: 'Drill press is out.',
      },
      context,
    )
    expect(message.subject).toBe('Example Robotics: huddle for Sat, Oct 10')
    expect(message.text).toContain('Check in with Avery K..')
    expect(message.text).toContain(
      '3:30 PM  Safety check\n4:00 PM  Field time (Ms. Patel) · Circuit Breakers, Coaches & mentors',
    )
    expect(message.text).toContain('Heads-ups and needs\nDrill press is out.')
    expect(message.text).toContain('https://example.web.app/huddle')
  })
  it('a quick note', () => {
    const message = huddleMessage(
      { kind: 'note', date: '2026-10-10', authorId: 'coach', text: 'Room 214 is locked.' },
      context,
    )
    expect(message.subject).toBe('Example Robotics: quick note from Coach Rivera')
    expect(message.text).toContain('Room 214 is locked.')
  })
})

describe('text helpers', () => {
  it('turns rich text into lines of plain text', () => {
    expect(htmlToText('<h2>Plan</h2><p>One &amp; two<br>three</p>')).toBe('Plan\nOne & two\nthree')
  })
  it('formats times', () => {
    expect([clock('09:05'), clock('12:00'), clock('00:15')]).toEqual([
      '9:05 AM',
      '12:00 PM',
      '12:15 AM',
    ])
  })
})
