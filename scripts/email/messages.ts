// Who gets an email, and what it says. Pure functions (unit-tested); the sender in outbox.ts supplies the data.
import { clock, escapeHtml, htmlToText } from './text'

export interface Person {
  id: string
  displayName: string
  role: 'student' | 'lead' | 'mentor' | 'coach'
  teamIds: string[]
}
export interface AnnouncementPost {
  title: string
  bodyHtml: string
  body: string
  /** ["all"] or team ids */
  audience: string[]
  authorId: string
}
export interface HuddlePost {
  kind: 'huddle' | 'note'
  date: string
  authorId: string
  statusHtml?: string
  status?: string
  plan?: { time: string; text: string; audience: string[]; runBy?: string }[]
  notesHtml?: string
  notes?: string
  textHtml?: string
  text?: string
}
export interface Message {
  subject: string
  text: string
  html: string
}
export interface Context {
  programName: string
  /** Where the app lives, e.g. https://example.web.app */
  appUrl: string
  people: readonly Person[]
  teamNames: Readonly<Record<string, string>>
}

const isAdult = (person: Person) => person.role === 'coach' || person.role === 'mentor'

/**
 * An announcement goes to the people who can read it in the app, except its author: everyone for a program-wide
 * post, otherwise the students, leads, and mentors of its teams, plus every program coach (they read every team's
 * posts). `includeStudents: false` keeps email to adults.
 */
export function announcementRecipients(
  post: Pick<AnnouncementPost, 'audience' | 'authorId'>,
  people: readonly Person[],
  { includeStudents = true } = {},
): Person[] {
  const everyone = post.audience.includes('all')
  return people.filter(
    (person) =>
      person.id !== post.authorId &&
      (everyone ||
        person.role === 'coach' ||
        person.teamIds.some((teamId) => post.audience.includes(teamId))) &&
      (includeStudents || isAdult(person)),
  )
}

/** Huddles and quick notes go to every coach and mentor, except the author. */
export function huddleRecipients(
  post: Pick<HuddlePost, 'authorId'>,
  people: readonly Person[],
): Person[] {
  return people.filter((person) => isAdult(person) && person.id !== post.authorId)
}

const nameOf = (context: Context, id: string) =>
  context.people.find((person) => person.id === id)?.displayName ?? 'Someone'

function message(subject: string, blocks: string[], link: { label: string; url: string }): Message {
  const text = [...blocks, `${link.label}: ${link.url}`].join('\n\n')
  const html = [
    ...blocks.map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`),
    `<p><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>`,
  ].join('\n')
  return { subject, text, html }
}

export function announcementMessage(post: AnnouncementPost, context: Context): Message {
  const to = post.audience.includes('all')
    ? 'all teams'
    : post.audience.map((id) => context.teamNames[id] ?? 'a team').join(', ')
  return message(
    `${context.programName}: ${post.title}`,
    [
      `${nameOf(context, post.authorId)} posted to ${to}:`,
      post.title,
      (post.bodyHtml ? htmlToText(post.bodyHtml) : post.body) || '(no text)',
    ],
    { label: `Open ${context.programName}`, url: context.appUrl },
  )
}

function day(iso: string): string {
  const [y = 2000, m = 1, d = 1] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function huddleMessage(post: HuddlePost, context: Context): Message {
  const link = { label: 'Open the huddle', url: `${context.appUrl}/huddle` }
  const author = nameOf(context, post.authorId)
  if (post.kind === 'note')
    return message(
      `${context.programName}: quick note from ${author}`,
      [(post.textHtml ? htmlToText(post.textHtml) : post.text) || '(no text)'],
      link,
    )
  const blocks: string[] = [`${author} posted the huddle for ${day(post.date)}.`]
  const status = post.statusHtml ? htmlToText(post.statusHtml) : post.status
  if (status) blocks.push(`Where things stand\n${status}`)
  if (post.plan?.length)
    blocks.push(
      [
        'Plan for the session',
        ...post.plan.map((row) => {
          const who = row.audience
            .filter((id) => id !== 'all')
            .map((id) => (id === 'adults' ? 'Coaches & mentors' : (context.teamNames[id] ?? '')))
            .filter(Boolean)
            .join(', ')
          const runBy = row.runBy ? ` (${nameOf(context, row.runBy)})` : ''
          return `${clock(row.time)}  ${row.text}${runBy}${who ? ` · ${who}` : ''}`
        }),
      ].join('\n'),
    )
  const notes = post.notesHtml ? htmlToText(post.notesHtml) : post.notes
  if (notes) blocks.push(`Heads-ups and needs\n${notes}`)
  return message(`${context.programName}: huddle for ${day(post.date)}`, blocks, link)
}
