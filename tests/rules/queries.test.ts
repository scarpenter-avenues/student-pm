// The app's own queries and writes (src/data), run as the roles that use them. A query the rules can't prove safe fails
// as a whole, so every query in src/data/queries.ts needs a case here.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { getDoc, getDocs, type Firestore } from 'firebase/firestore'
import { createRefs } from '@/data/refs'
import { createQueries } from '@/data/queries'
import { createWrites } from '@/data/writes'
import { as, makeEnv, seed, type Uid } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await makeEnv()
})
beforeEach(() => seed(env))
afterAll(() => env.cleanup())

function data(uid: Uid) {
  const db: Firestore = as(env, uid)
  const refs = createRefs(db, 'p1')
  return { refs, q: createQueries(refs), writes: createWrites(refs, () => uid) }
}

describe('task queries', () => {
  it('the team reads its sprint, My Tasks, Planning, and archived tasks, in rank order', async () => {
    const { q } = data('studentA')
    const sprint = await assertSucceeds(getDocs(q.sprintTasks('teamA', 's3')))
    expect(sprint.docs.map((d) => d.id).sort()).toEqual(['issue1', 't1'])
    expect(sprint.docs[0]!.data().id).toBe(sprint.docs[0]!.id) // the converter adds ids
    await assertSucceeds(getDocs(q.myTasks('teamA', 's3', 'studentA')))
    await assertSucceeds(getDocs(q.planningTasks('teamA')))
    const archived = await assertSucceeds(getDocs(q.archivedTasks('teamA')))
    expect(archived.docs.map((d) => d.id)).toEqual(['archived1'])
    await assertSucceeds(getDocs(q.comments('teamA', 't1')))
  })
  it("other teams' tasks are refused", async () => {
    const { q } = data('studentB')
    await assertFails(getDocs(q.sprintTasks('teamA', 's3')))
    await assertFails(getDocs(q.planningTasks('teamA')))
  })
  it('program coaches read any team', async () => {
    await assertSucceeds(getDocs(data('coach').q.planningTasks('teamB')))
  })
})

describe('sprints, people, events', () => {
  it('a team reads its sprints, roster, coaches, and events', async () => {
    const { q } = data('studentA')
    const sprints = await assertSucceeds(getDocs(q.sprints('teamA', '2026-27')))
    expect(sprints.size).toBe(1)
    const roster = await assertSucceeds(getDocs(q.teamMembers('teamA')))
    expect(roster.docs.map((d) => d.id).sort()).toEqual([
      'leadA',
      'mentorA',
      'studentA',
      'studentA2',
    ])
    await assertSucceeds(getDocs(q.coaches()))
    await assertSucceeds(getDocs(q.teamEvents('teamA')))
    await assertSucceeds(getDocs(q.programEvents()))
    await assertFails(getDocs(q.teamEvents('teamB')))
  })
})

describe('announcements and huddles', () => {
  it("a team's feed: its own and program-wide posts", async () => {
    const feed = await assertSucceeds(getDocs(data('studentA').q.teamAnnouncements('teamA')))
    expect(feed.docs.map((d) => d.id).sort()).toEqual(['a1', 'a2'])
    await assertFails(getDocs(data('studentA').q.teamAnnouncements('teamB')))
  })
  it('only program coaches read every post', async () => {
    await assertSucceeds(getDocs(data('coach').q.allAnnouncements()))
    await assertFails(getDocs(data('mentorA').q.allAnnouncements()))
  })
  it('adults read huddles and mark them read; students cannot', async () => {
    await assertSucceeds(getDocs(data('mentorA').q.huddles()))
    await assertFails(getDocs(data('studentA').q.huddles()))
    await assertSucceeds(data('mentorA').writes.markHuddlesRead(['h1']))
  })
  it('anyone marks announcements read in their own state', async () => {
    const { refs, writes } = data('studentA')
    await assertSucceeds(writes.markAnnouncementsRead(['a1']))
    await assertSucceeds(writes.markAnnouncementsRead(['a2']))
    const state = await getDoc(refs.userState('studentA'))
    expect(state.data()?.announcementsRead).toEqual({ a1: true, a2: true })
    // Someone with no state doc yet.
    await assertSucceeds(data('leadA').writes.markAnnouncementsRead(['a1']))
  })
})

describe('goal queries', () => {
  it('teammates read active goal cards; students read their own goals and full history', async () => {
    await assertSucceeds(getDocs(data('studentA2').q.teamGoalCards('teamA')))
    await assertSucceeds(getDocs(data('studentA').q.myGoals('studentA')))
    const history = await assertSucceeds(getDocs(data('studentA').q.goalEvents('g1')))
    expect(history.size).toBe(2)
  })
  it("a student can't list another student's goals", async () => {
    await assertFails(getDocs(data('studentA2').q.myGoals('studentA')))
  })
  it("mentors read their teams' goals, and goal history only from their teams", async () => {
    const { q } = data('mentorA')
    await assertSucceeds(getDocs(q.teamGoals(['teamA'])))
    await assertFails(getDocs(q.teamGoals(['teamA', 'teamB'])))
    const history = await assertSucceeds(getDocs(q.goalEvents('g1', ['teamA'])))
    expect(history.docs.map((d) => d.id)).toEqual(['e1'])
    // Without the team filter the query could include teamB's feedback, so it's refused as a whole.
    await assertFails(getDocs(q.goalEvents('g1')))
  })
  it('program coaches read every goal and its whole history', async () => {
    const { q } = data('coach')
    await assertSucceeds(getDocs(q.teamGoals(['teamA', 'teamB'])))
    const history = await assertSucceeds(getDocs(q.goalEvents('g1')))
    expect(history.size).toBe(2)
  })
})

describe('task writes', () => {
  it('a student adds, edits, archives, and restores a task; only adults delete archived ones', async () => {
    const { refs, writes } = data('studentA')
    const { id, written } = writes.addTask(
      'teamA',
      { title: '  Wire the intake  ', sprintId: 's3' },
      'a5',
    )
    await assertSucceeds(written)
    const added = (await getDoc(refs.task('teamA', id))).data()!
    expect(added).toMatchObject({
      title: 'Wire the intake',
      createdBy: 'studentA',
      rank: 'a5',
      archived: null,
    })
    await assertSucceeds(
      writes.updateTask('teamA', id, { status: 'In progress', assigneeIds: ['studentA'] }),
    )
    await assertSucceeds(writes.archiveTask('teamA', id, 'Sprint 3'))
    expect((await getDoc(refs.task('teamA', id))).data()?.archived?.by).toBe('studentA')
    await assertFails(writes.deleteTask('teamA', id))
    await assertSucceeds(writes.restoreTask('teamA', id))
    await assertSucceeds(writes.archiveTask('teamA', id, 'Sprint 3'))
    await assertSucceeds(data('mentorA').writes.deleteTask('teamA', id))
  })
  it("can't add a task to another team or make one a GitHub issue", async () => {
    await assertFails(data('studentB').writes.addTask('teamA', { title: 'Sneaky' }, 'a5').written)
    await assertFails(
      data('studentA').writes.addTask('teamA', { title: 'Fake issue', type: 'GitHub issue' }, 'a5')
        .written,
    )
  })
  it('comments are added as yourself', async () => {
    await assertSucceeds(data('studentA').writes.addComment('teamA', 't1', 'Looks good'))
  })
})
