// The email sender (scripts/email), run for real against the Firestore emulator: the app posts as each role, then
// the sender reads the outbox the way Apps Script will (plain REST as the project's owner) and "sends" into a fake
// mailbox. Sign-in emails come from a stand-in for Firebase Authentication.
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { getDoc, type Firestore } from 'firebase/firestore'
import { createRefs } from '@/data/refs'
import { createWrites } from '@/data/writes'
import { processOutbox, type Mail, type Settings } from '../../scripts/email/outbox'
import { createStore, type Request } from '../../scripts/email/rest'
import { as, makeEnv, people, seed, type Uid } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await makeEnv()
})
beforeEach(() => seed(env))
afterAll(() => env.cleanup())

const HOSTS = { firestore: 'http://127.0.0.1:8080', auth: 'http://auth.test' }
/** Synchronous HTTP, like Apps Script's UrlFetchApp. "Bearer owner" is the emulator's admin. */
const request: Request = (method, url, body) => {
  if (url.startsWith(HOSTS.auth))
    return {
      status: 200,
      json: {
        users: Object.entries(people).map(([localId, person]) => ({
          localId,
          email: person.email,
        })),
      },
    }
  const out = execFileSync(
    'curl',
    [
      '-s',
      '-g',
      '-X',
      method,
      '-H',
      'Authorization: Bearer owner',
      '-H',
      'Content-Type: application/json',
      '-w',
      '\n%{http_code}',
      ...(body === undefined ? [] : ['-d', JSON.stringify(body)]),
      url,
    ],
    { encoding: 'utf8' },
  )
  const at = out.lastIndexOf('\n')
  return { status: Number(out.slice(at + 1)), json: JSON.parse(out.slice(0, at) || 'null') }
}

function data(uid: Uid) {
  const db: Firestore = as(env, uid)
  const refs = createRefs(db, 'p1')
  return { refs, writes: createWrites(refs, () => uid) }
}
function run(settings: Partial<Settings> = {}) {
  const sent: Mail[] = []
  let quota = 100
  const results = processOutbox(
    createStore(request, HOSTS, 'demo-switchback-rules', 'p1'),
    {
      sendMail: (mail) => {
        sent.push(mail)
        quota -= mail.bcc.length
      },
      quota: () => quota,
      log: () => {},
    },
    { appUrl: 'https://example.web.app', includeStudents: true, redirectTo: null, ...settings },
  )
  return { sent, results, setQuota: (n: number) => (quota = n) }
}
const post = { title: 'Saturday practice', bodyHtml: '<p>10 to noon.</p>', body: '10 to noon.' }

describe('the email sender', () => {
  it("emails a team's announcement to that team once, and records it", async () => {
    await data('leadA').writes.postAnnouncement({ ...post, audience: ['teamA'], emailed: true })
    const { sent, results } = run()
    expect(sent).toHaveLength(1)
    expect([...sent[0]!.bcc].sort()).toEqual(
      [
        'coach@example.edu',
        'mentor.a@example.edu',
        'student.a2@example.edu',
        'student.a@example.edu',
      ].sort(),
    )
    expect(sent[0]!.subject).toBe('Example Robotics: Saturday practice')
    expect(sent[0]!.text).toContain('10 to noon.')
    expect(results.map((r) => [r.state, r.recipients])).toEqual([['sent', 4]])
    const item = (
      await getDoc(data('coach').refs.outboxItem('announcement', results[0]!.id.slice(13)))
    ).data()
    expect(item?.state).toBe('sent')
    expect(item?.recipients).toBe(4)
    // A second run finds nothing to do.
    expect(run().sent).toHaveLength(0)
  })
  it('sends nothing for a post made without email', async () => {
    await data('leadA').writes.postAnnouncement({ ...post, audience: ['teamA'], emailed: false })
    expect(run().sent).toHaveLength(0)
  })
  it('can leave students out', async () => {
    await data('coach').writes.postAnnouncement({ ...post, audience: ['all'], emailed: true })
    const { sent } = run({ includeStudents: false })
    expect([...sent[0]!.bcc].sort()).toEqual(['mentor.a@example.edu', 'volunteer.b@gmail.com'])
  })
  it('emails huddles to mentors only (the coach wrote it), never to students', async () => {
    await data('coach').writes.postHuddle(
      { kind: 'huddle', date: '2026-10-10', status: 'On track', statusHtml: '<p>On track</p>' },
      true,
    )
    const { sent } = run()
    expect([...sent[0]!.bcc].sort()).toEqual(['mentor.a@example.edu', 'volunteer.b@gmail.com'])
    expect(sent[0]!.text).toContain('https://example.web.app/huddle')
  })
  it('in test mode, everything goes to one address and says who it was for', async () => {
    await data('coach').writes.postAnnouncement({ ...post, audience: ['all'], emailed: true })
    const { sent, results } = run({ redirectTo: 'me@example.edu' })
    expect(sent.map((mail) => mail.bcc)).toEqual([['me@example.edu']])
    expect(sent[0]!.subject).toBe('[TEST] Example Robotics: Saturday practice')
    expect(sent[0]!.text).toContain('would have gone to 6 people')
    expect(results[0]!.state).toBe('sent')
  })
  it('skips a post that was deleted before its turn', async () => {
    const { writes, refs } = data('coach')
    await writes.postHuddle({ kind: 'note', date: '2026-10-10', text: 'Never mind' }, true)
    const { deleteDoc, getDocs } = await import('firebase/firestore')
    const huddles = await getDocs(refs.huddles())
    await deleteDoc(huddles.docs.find((d) => d.data().text === 'Never mind')!.ref)
    const { sent, results } = run()
    expect(sent).toHaveLength(0)
    expect(results.map((r) => r.state)).toEqual(['skipped'])
  })
  it("waits for tomorrow when today's quota is too small, instead of emailing only some people", async () => {
    await data('coach').writes.postAnnouncement({ ...post, audience: ['all'], emailed: true })
    const sent: Mail[] = []
    const results = processOutbox(
      createStore(request, HOSTS, 'demo-switchback-rules', 'p1'),
      { sendMail: (mail) => sent.push(mail), quota: () => 2, log: () => {} },
      { appUrl: 'https://example.web.app', includeStudents: true, redirectTo: null },
    )
    expect(sent).toHaveLength(0)
    expect(results.map((r) => r.state)).toEqual(['waiting'])
    // Still pending, so the next run (with quota) sends it.
    expect(run().sent).toHaveLength(1)
  })
})
