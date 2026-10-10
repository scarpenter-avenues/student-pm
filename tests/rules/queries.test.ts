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

describe('people', () => {
  it('mentors list and add invites for their team; coaches for any', async () => {
    await assertSucceeds(getDocs(data('mentorA').q.teamInvites('teamA')))
    await assertFails(getDocs(data('mentorA').q.teamInvites('teamB')))
    await assertSucceeds(getDocs(data('coach').q.allInvites()))
    await assertSucceeds(
      data('mentorA').writes.saveInvite({
        email: 'New.Kid@example.edu',
        displayName: 'New K.',
        role: 'student',
        teamIds: ['teamA'],
        subteams: {},
      }),
    )
    await assertFails(
      data('mentorA').writes.saveInvite({
        email: 'helper@example.edu',
        displayName: 'Helper',
        role: 'mentor',
        teamIds: ['teamA'],
        subteams: {},
      }),
    )
    await assertSucceeds(data('mentorA').writes.deleteInvite('new.kid@example.edu'))
  })
  it('leads change subteams; mentors change roles of students on their team', async () => {
    await assertSucceeds(
      data('leadA').writes.updateMember('studentA', { subteams: { teamA: ['mech'] } }),
    )
    await assertFails(data('leadA').writes.updateMember('studentA', { role: 'lead' }))
    await assertSucceeds(data('mentorA').writes.updateMember('studentA', { role: 'lead' }))
    await assertFails(data('mentorA').writes.updateMember('studentB', { role: 'lead' }))
  })
})

describe('goal writes', () => {
  const load = async (uid: Uid, id = 'g1') => {
    const snap = await getDoc(data(uid).refs.goal(id))
    return snap.data()!
  }
  it('a student sets a goal (goal, summary, and created event in one batch)', async () => {
    const { writes } = data('studentA')
    const { id, written } = writes.createGoal(
      {
        teamId: 'teamA',
        seasonId: '2026-27',
        wish: 'learn Java for FTC',
        evidence: 'My tele-op works',
        obstacle: 'I forget syntax',
        plan: 'If I forget, then I check my notes',
        by: { label: 'End of Sprint 5', date: '2026-11-15' },
      },
      '2026-10-09',
    )
    await assertSucceeds(written)
    // Teammates can't read the goal itself, only its summary.
    await assertFails(getDoc(data('studentA2').refs.goal(id)))
    const summary = await getDocs(data('studentA2').q.teamGoalCards('teamA'))
    expect(summary.docs.map((d) => d.data().statement)).toContain('Learn Java for FTC')
  })
  it('a student checks in (event, goal, and summary together); a teammate cannot', async () => {
    const goal = await load('studentA')
    await assertSucceeds(
      data('studentA').writes.updateGoal(
        goal,
        { status: 'Almost there', lastCheckinAt: '2026-10-09' },
        { type: 'checkin', status: 'Almost there', planResult: 'It worked', note: '', taskIds: [] },
        '2026-10-09',
      ),
    )
    await assertFails(
      data('studentA2').writes.updateGoal(
        goal,
        { status: 'Stuck' },
        { type: 'checkin', status: 'Stuck' },
        '2026-10-09',
      ),
    )
  })
  it('adults post feedback; students reply and clear their unread count', async () => {
    const goal = await load('mentorA')
    await assertSucceeds(data('mentorA').writes.postFeedback(goal, 'Nice progress', '2026-10-09'))
    await assertFails(data('mentorB').writes.postFeedback(goal, 'From another team', '2026-10-09'))
    expect((await load('studentA')).unreadFeedback).toBe(1)
    await assertSucceeds(
      data('studentA').writes.replyToFeedback(goal, 'e2', 'Thanks!', '2026-10-09'),
    )
    await assertSucceeds(data('studentA').writes.markFeedbackRead('g1'))
  })
  it('a student pauses and finishes their goal', async () => {
    const goal = await load('studentA')
    await assertSucceeds(
      data('studentA').writes.updateGoal(
        goal,
        { state: 'paused' },
        { type: 'paused', reason: 'Focusing on my other goal' },
        '2026-10-09',
      ),
    )
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
