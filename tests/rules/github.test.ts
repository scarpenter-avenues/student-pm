// The GitHub sync (scripts/github), run for real against the Firestore emulator the way Apps Script will (plain
// REST as the project's owner), with a stand-in for GitHub's API. Then the app's own reads check what a team sees.
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, getDocs, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { createRefs } from '@/data/refs'
import { createQueries } from '@/data/queries'
import { createStore, type Request } from '../../scripts/email/rest'
import { syncGithub, taskIdFor, type GithubIo, type Issue } from '../../scripts/github/sync'
import { as, makeEnv, seed } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await makeEnv()
})
afterAll(() => env.cleanup())

const REPO = 'example-robotics/test-team'
/** Synchronous HTTP, like Apps Script's UrlFetchApp. "Bearer owner" is the emulator's admin. */
const request: Request = (method, url, body) => {
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
// The sync's own database client, pointed at the emulator.
const store = () =>
  createStore(
    request,
    { firestore: 'http://127.0.0.1:8080', auth: '' },
    'demo-switchback-rules',
    'p1',
  )

/** GitHub, as far as the sync can tell: a list of issues, and what it was asked for. */
let issues: Issue[]
let asked: string[]
let cursors: Record<string, string>
let clock: Date
const io: GithubIo = {
  github(path) {
    asked.push(path)
    if (!path.startsWith(`/repos/${REPO}/issues`))
      return { status: 404, json: { message: 'Not Found' } }
    return {
      status: 200,
      json: path.includes('state=open') ? issues.filter((i) => i.state === 'open') : issues,
    }
  },
  cursor: (key) => cursors[key] ?? null,
  setCursor: (key, iso) => (cursors[key] = iso),
  now: () => clock,
  log: () => {},
}
// A made-up GitHub issue, open unless told otherwise.
const issue = (number: number, title: string, over: Partial<Issue> = {}): Issue => ({
  number,
  title,
  body: `About ${title}`,
  state: 'open',
  html_url: `https://github.com/${REPO}/issues/${number}`,
  ...over,
})

// Runs something with the rules switched off, to set up or inspect data the way the project owner would.
function admin<T>(run: (db: Firestore) => Promise<T>) {
  let out!: T
  return env
    .withSecurityRulesDisabled(async (context) => {
      out = await run(context.firestore() as unknown as Firestore)
    })
    .then(() => out)
}
// Connects a team to the test repo with both options on, plus anything a test overrides.
const connect = (teamId: string, github: Record<string, unknown>) =>
  admin((db) =>
    updateDoc(doc(db, `programs/p1/teams/${teamId}`), {
      subteams: [{ id: 'software', name: 'Software', color: 'green', description: '' }],
      github: { repo: REPO, importIssues: true, closeOnDone: true, ...github },
    }),
  )
// The task the sync made for an issue number (undefined if there is none).
const taskOf = (number: number) =>
  admin(async (db) =>
    (await getDoc(doc(db, `programs/p1/teams/teamA/tasks/${taskIdFor(REPO, number)}`))).data(),
  )

beforeEach(async () => {
  await seed(env)
  issues = [
    issue(3, 'Lift requirements'),
    issue(4, 'Old idea', { state: 'closed' }),
    issue(8, 'Sub task'),
  ]
  asked = []
  cursors = {}
  clock = new Date('2026-10-11T12:00:00Z')
})

describe('the GitHub sync', () => {
  it("adds a repo's open issues to the Backlog, in the chosen subteam, after the team's other tasks", async () => {
    await connect('teamA', { subteamIds: ['software', 'deleted-subteam'] })
    const results = syncGithub(store(), io)
    expect(results).toEqual([{ team: 'teamA', repo: REPO, created: 2, updated: 0 }])
    const three = await taskOf(3)
    expect(three).toMatchObject({
      title: 'Lift requirements',
      type: 'GitHub issue',
      status: 'To do',
      sprintId: null,
      subteamIds: ['software'],
      descriptionHtml: '<p>About Lift requirements</p>',
      archived: null,
      github: { repo: REPO, number: 3, state: 'open' },
    })
    expect(await taskOf(4)).toBeUndefined() // closed before it was ever seen
    // After every task the team already had, and in issue order.
    const eight = await taskOf(8)
    expect(three!.rank < eight!.rank).toBe(true)
    // A teammate sees them in Planning's Backlog, through the app's own query and the rules.
    const refs = createRefs(as(env, 'studentA'), 'p1')
    const backlog = (await getDocs(createQueries(refs).planningTasks('teamA'))).docs.map((d) =>
      d.data(),
    )
    const titles = backlog.filter((t) => t.sprintId === null).map((t) => t.title)
    expect(titles.slice(-2)).toEqual(['Lift requirements', 'Sub task'])
  })

  it('a second run with nothing new changes nothing, and only asks for what changed since', async () => {
    await connect('teamA', {})
    syncGithub(store(), io)
    asked = []
    expect(syncGithub(store(), io)).toEqual([{ team: 'teamA', repo: REPO, created: 0, updated: 0 }])
    expect(asked[0]).toContain('state=all&since=2026-10-11T11%3A59%3A00.000Z')
  })

  it('closing an issue marks its task Done; reopening moves it back; a new title follows', async () => {
    await connect('teamA', {})
    syncGithub(store(), io)
    issues = [issue(3, 'Lift requirements v2', { state: 'closed' })]
    expect(syncGithub(store(), io)[0]).toMatchObject({ created: 0, updated: 1 })
    expect(await taskOf(3)).toMatchObject({
      title: 'Lift requirements v2',
      status: 'Done',
      github: { state: 'closed' },
    })
    issues = [issue(3, 'Lift requirements v2')]
    syncGithub(store(), io)
    expect(await taskOf(3)).toMatchObject({ status: 'To do', github: { state: 'open' } })
  })

  it("keeps a description the team edited, and a task they've moved or assigned", async () => {
    await connect('teamA', {})
    syncGithub(store(), io)
    await admin((db) =>
      updateDoc(doc(db, `programs/p1/teams/teamA/tasks/${taskIdFor(REPO, 3)}`), {
        descriptionHtml: '<p>Our notes</p>',
        sprintId: 's3',
        assigneeIds: ['studentA'],
      }),
    )
    issues = [issue(3, 'Lift requirements', { body: 'Rewritten on GitHub' })]
    syncGithub(store(), io)
    expect(await taskOf(3)).toMatchObject({
      descriptionHtml: '<p>Our notes</p>',
      sprintId: 's3',
      assigneeIds: ['studentA'],
    })
  })

  it("skips teams without a repo, and one team's bad repo doesn't stop another's", async () => {
    await connect('teamA', {})
    await admin((db) =>
      setDoc(
        doc(db, 'programs/p1/teams/teamB'),
        { github: { repo: 'nobody/nothing', importIssues: true, closeOnDone: true } },
        { merge: true },
      ),
    )
    const results = syncGithub(store(), io)
    expect(results.find((r) => r.team === 'teamA')).toMatchObject({ created: 2 })
    expect(results.find((r) => r.team === 'teamB')?.note).toMatch(/can't find nobody\/nothing/)
  })

  it('with adding issues off, nothing is added, but tasks that exist still follow their issues', async () => {
    await connect('teamA', {})
    syncGithub(store(), io)
    await connect('teamA', { importIssues: false })
    issues = [issue(3, 'Lift requirements', { state: 'closed' }), issue(9, 'Brand new')]
    syncGithub(store(), io)
    expect(await taskOf(9)).toBeUndefined()
    expect(await taskOf(3)).toMatchObject({ status: 'Done' })
  })
})
