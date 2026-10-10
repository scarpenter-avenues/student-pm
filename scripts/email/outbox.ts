// Sends what's waiting in the outbox. One run: read pending items, and for each one claim it (so two runs can't
// both send it), load the post, work out who gets it, send, and record what happened. A post deleted before its
// turn is skipped. Runs synchronously, because Apps Script's network and mail calls are synchronous.
import {
  announcementMessage,
  announcementRecipients,
  huddleMessage,
  huddleRecipients,
  type AnnouncementPost,
  type Context,
  type HuddlePost,
  type Message,
  type Person,
} from './messages'
import type { Store } from './rest'

export interface Mail extends Message {
  /** Everyone is blind-copied, so nobody sees anyone else's address. */
  bcc: string[]
  fromName: string
}
export interface Io {
  sendMail(mail: Mail): void
  /** How many more recipients can be mailed today (Gmail's daily limit). */
  quota(): number
  log(message: string): void
}
export interface Settings {
  /** Where the app lives, e.g. https://example.web.app (no trailing slash). */
  appUrl: string
  /** false: announcements are emailed to mentors and coaches only. */
  includeStudents: boolean
  /** Testing: every email goes to this one address instead of the real recipients. */
  redirectTo: string | null
}
export interface Result {
  id: string
  state: 'sent' | 'skipped' | 'failed' | 'waiting' | 'taken'
  recipients: number
  note?: string
}

/** Gmail allows 100 recipients on one message from a script; stay well under. */
const BCC_PER_MESSAGE = 40

export function processOutbox(store: Store, io: Io, settings: Settings): Result[] {
  const pending = store.pending(20)
  if (!pending.length) return []

  const program = store.get('')
  const programName = String(program?.data.name ?? 'Switchback')
  const people: Person[] = store.list('members').map((doc) => ({
    id: doc.id,
    displayName: String(doc.data.displayName ?? ''),
    role: doc.data.role as Person['role'],
    teamIds: (doc.data.teamIds as string[] | undefined) ?? [],
  }))
  const teamNames = Object.fromEntries(
    store.list('teams').map((doc) => [doc.id, String(doc.data.name ?? '')]),
  )
  const context: Context = { programName, appUrl: settings.appUrl, people, teamNames }
  let emails: Record<string, string> | null = null

  return pending.map((item): Result => {
    const finish = (state: 'sent' | 'skipped' | 'failed', recipients: number, note = '') => {
      store.patch(item, { state, recipients, note: note.slice(0, 300), sentAt: new Date() })
      io.log(
        `${item.id}: ${state}${recipients ? ` to ${recipients}` : ''}${note ? ` (${note})` : ''}`,
      )
      return { id: item.id, state, recipients, ...(note ? { note } : {}) }
    }
    try {
      const kind = item.data.kind
      const post = store.get(
        `${kind === 'announcement' ? 'announcements' : 'huddles'}/${String(item.data.sourceId)}`,
      )
      const to = !post
        ? []
        : kind === 'announcement'
          ? announcementRecipients(post.data as unknown as AnnouncementPost, people, settings)
          : huddleRecipients(post.data as unknown as HuddlePost, people)
      emails ??= store.emails()
      const addresses = [
        ...new Set(to.map((person) => emails![person.id]).filter(Boolean)),
      ] as string[]

      // Not enough of today's quota left: leave it pending for the next day rather than send to only some people.
      const needed = settings.redirectTo ? 1 : addresses.length
      if (post && needed > io.quota()) {
        io.log(`${item.id}: waiting (needs ${needed} recipients, ${io.quota()} left today)`)
        return { id: item.id, state: 'waiting', recipients: 0 }
      }
      // Claim it. If another run got there first, leave it alone.
      if (!store.patch(item, { state: 'sending' }, item.updateTime))
        return { id: item.id, state: 'taken', recipients: 0 }
      if (!post) return finish('skipped', 0, 'The post was deleted before it was emailed.')
      if (!addresses.length) return finish('skipped', 0, 'Nobody to email.')

      const message =
        kind === 'announcement'
          ? announcementMessage(post.data as unknown as AnnouncementPost, context)
          : huddleMessage(post.data as unknown as HuddlePost, context)
      if (settings.redirectTo) {
        const note = `TEST: this would have gone to ${addresses.length} ${addresses.length === 1 ? 'person' : 'people'}: ${to
          .filter((person) => emails![person.id])
          .map((person) => person.displayName)
          .join(', ')}.`
        io.sendMail({
          ...message,
          subject: `[TEST] ${message.subject}`,
          text: `${note}\n\n${message.text}`,
          html: `<p><em>${note.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</em></p>\n${message.html}`,
          bcc: [settings.redirectTo],
          fromName: programName,
        })
      } else
        for (let i = 0; i < addresses.length; i += BCC_PER_MESSAGE)
          io.sendMail({
            ...message,
            bcc: addresses.slice(i, i + BCC_PER_MESSAGE),
            fromName: programName,
          })
      return finish('sent', addresses.length)
    } catch (error) {
      const note = error instanceof Error ? error.message : String(error)
      try {
        return finish('failed', 0, note)
      } catch {
        io.log(`${item.id}: failed (${note})`)
        return { id: item.id, state: 'failed', recipients: 0, note }
      }
    }
  })
}
