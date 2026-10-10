import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { PROGRAM, as, makeEnv, seed, task } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await makeEnv()
})
beforeEach(() => seed(env))
afterAll(() => env.cleanup())

const teamA = `${PROGRAM}/teams/teamA`
const teamB = `${PROGRAM}/teams/teamB`

describe('teams', () => {
  it('students see only their own team; coaches see every team', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'studentA'), teamA)))
    await assertFails(getDoc(doc(as(env, 'studentA'), teamB)))
    await assertSucceeds(getDoc(doc(as(env, 'coach'), teamB)))
  })
  it("mentors edit their team's look, but not its seasons", async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'mentorA'), teamA), { color: '#c0392b' }))
    await assertFails(updateDoc(doc(as(env, 'mentorA'), teamB), { color: '#c0392b' }))
    await assertFails(
      updateDoc(doc(as(env, 'mentorA'), teamA), { seasonIds: ['2026-27', '2027-28'] }),
    )
    await assertSucceeds(
      updateDoc(doc(as(env, 'coach'), teamA), { seasonIds: ['2026-27', '2027-28'] }),
    )
    await assertFails(updateDoc(doc(as(env, 'studentA'), teamA), { color: 'red' }))
  })
  it("team leads edit their team's name, number, color, subteams, and GitHub, and nothing else", async () => {
    const lead = as(env, 'leadA')
    await assertSucceeds(
      updateDoc(doc(lead, teamA), { name: 'Team A', number: '419', color: 'teal' }),
    )
    await assertSucceeds(updateDoc(doc(lead, teamA), { subteams: [] }))
    await assertSucceeds(
      updateDoc(doc(lead, teamA), {
        github: { repo: 'example/robot', importIssues: true, closeOnDone: true },
      }),
    )
    await assertFails(updateDoc(doc(lead, teamA), { sprintDays: 7 }))
    await assertFails(updateDoc(doc(lead, teamA), { seasonIds: [] }))
    await assertFails(updateDoc(doc(lead, teamB), { color: 'teal' }))
  })
  it('sprints and objectives: everyone on the team reads; leads and adults edit', async () => {
    const sprint = `${teamA}/sprints/s3`
    await assertSucceeds(getDoc(doc(as(env, 'studentA'), sprint)))
    await assertFails(updateDoc(doc(as(env, 'studentA'), sprint), { end: '2026-10-20' }))
    await assertSucceeds(updateDoc(doc(as(env, 'leadA'), sprint), { end: '2026-10-20' }))
    await assertSucceeds(
      updateDoc(doc(as(env, 'mentorA'), sprint), {
        objectives: [{ id: 'o1', text: 'Intake works', subteamIds: [], met: true }],
      }),
    )
  })
  it('team events and Team Home: anyone on the team edits', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, 'studentA'), `${teamA}/pages/home`), { html: '<p>Updated</p>' }),
    )
    await assertSucceeds(
      addDoc(collection(as(env, 'studentA'), `${teamA}/events`), {
        title: 'Build night',
        date: '2026-10-20',
        time: '',
        location: '',
        type: 'Work session',
        conditional: false,
      }),
    )
    await assertFails(getDoc(doc(as(env, 'studentB'), `${teamA}/pages/home`)))
  })
  it('program-wide events: every member reads; only coaches edit', async () => {
    const event = {
      title: 'Championship',
      date: '2027-03-07',
      time: '',
      location: '',
      type: 'Competition',
      conditional: true,
    }
    await assertFails(setDoc(doc(as(env, 'mentorA'), `${PROGRAM}/events/champ`), event))
    await assertSucceeds(setDoc(doc(as(env, 'coach'), `${PROGRAM}/events/champ`), event))
    await assertSucceeds(getDoc(doc(as(env, 'studentB'), `${PROGRAM}/events/champ`)))
  })
})

describe('tasks', () => {
  const tasks = `${teamA}/tasks`
  it('anyone on the team adds tasks, as themselves', async () => {
    await assertSucceeds(setDoc(doc(as(env, 'studentA'), `${tasks}/new`), task()))
    await assertFails(
      setDoc(doc(as(env, 'studentA'), `${tasks}/new`), task({ createdBy: 'studentA2' })),
    )
    await assertFails(
      setDoc(doc(as(env, 'studentB'), `${tasks}/new`), task({ createdBy: 'studentB' })),
    )
  })
  it('tasks must be well-formed', async () => {
    await assertFails(
      setDoc(doc(as(env, 'studentA'), `${tasks}/new`), task({ title: 'x'.repeat(91) })),
    )
    await assertFails(setDoc(doc(as(env, 'studentA'), `${tasks}/new`), task({ status: 'Blocked' })))
    await assertFails(setDoc(doc(as(env, 'studentA'), `${tasks}/new`), task({ title: '' })))
  })
  it('only the GitHub sync creates issues, and their type is locked', async () => {
    await assertFails(
      setDoc(doc(as(env, 'studentA'), `${tasks}/new`), task({ type: 'GitHub issue' })),
    )
    await assertFails(updateDoc(doc(as(env, 'studentA'), `${tasks}/t1`), { type: 'GitHub issue' }))
    await assertFails(updateDoc(doc(as(env, 'mentorA'), `${tasks}/issue1`), { type: 'Task' }))
    await assertSucceeds(
      updateDoc(doc(as(env, 'studentA'), `${tasks}/issue1`), { status: 'In progress' }),
    )
    await assertFails(updateDoc(doc(as(env, 'studentA'), `${tasks}/issue1`), { github: null }))
  })
  it('anyone on the team edits tasks (status, rank, assignees, archive)', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, 'studentA2'), `${tasks}/t1`), {
        status: 'Done',
        rank: 'a1',
        assigneeIds: ['studentA2'],
      }),
    )
    await assertSucceeds(
      updateDoc(doc(as(env, 'studentA2'), `${tasks}/t1`), {
        archived: { by: 'studentA2', at: Timestamp.now(), from: 'Sprint 3' },
      }),
    )
    await assertFails(
      updateDoc(doc(as(env, 'studentA'), `${tasks}/t1`), { createdBy: 'studentA2' }),
    )
    await assertFails(updateDoc(doc(as(env, 'studentB'), `${tasks}/t1`), { status: 'Done' }))
  })
  it('hard delete: adults on the team, archived tasks only', async () => {
    await assertFails(deleteDoc(doc(as(env, 'studentA'), `${tasks}/archived1`)))
    await assertFails(deleteDoc(doc(as(env, 'mentorA'), `${tasks}/t1`)))
    await assertFails(deleteDoc(doc(as(env, 'mentorB'), `${tasks}/archived1`)))
    await assertSucceeds(deleteDoc(doc(as(env, 'mentorA'), `${tasks}/archived1`)))
  })
  it('the board, My Tasks, and Planning queries are allowed', async () => {
    const db = as(env, 'studentA')
    await assertSucceeds(
      getDocs(
        query(
          collection(db, tasks),
          where('sprintId', '==', 's3'),
          where('archived', '==', null),
          orderBy('rank'),
        ),
      ),
    )
    await assertSucceeds(
      getDocs(
        query(
          collection(db, tasks),
          where('assigneeIds', 'array-contains', 'studentA'),
          where('sprintId', '==', 's3'),
          where('archived', '==', null),
          orderBy('rank'),
        ),
      ),
    )
    await assertSucceeds(
      getDocs(query(collection(db, tasks), where('archived', '==', null), orderBy('rank'))),
    )
    await assertFails(
      getDocs(query(collection(db, `${teamB}/tasks`), where('archived', '==', null))),
    )
  })
})

describe('comments', () => {
  const comments = `${teamA}/tasks/t1/comments`
  it('team members comment as themselves', async () => {
    await assertSucceeds(
      addDoc(collection(as(env, 'studentA2'), comments), {
        authorId: 'studentA2',
        text: 'Nice',
        subtaskId: null,
        createdAt: Timestamp.now(),
      }),
    )
    await assertFails(
      addDoc(collection(as(env, 'studentA2'), comments), {
        authorId: 'studentA',
        text: 'Nice',
        subtaskId: null,
        createdAt: Timestamp.now(),
      }),
    )
    await assertFails(
      addDoc(collection(as(env, 'studentB'), comments), {
        authorId: 'studentB',
        text: 'Nice',
        subtaskId: null,
        createdAt: Timestamp.now(),
      }),
    )
  })
  it("you edit only your own comment's text; adults can remove any", async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, 'studentA'), `${comments}/c1`), { text: 'Printed shapes A and B' }),
    )
    await assertFails(updateDoc(doc(as(env, 'studentA2'), `${comments}/c1`), { text: 'Changed' }))
    await assertFails(deleteDoc(doc(as(env, 'studentA2'), `${comments}/c1`)))
    await assertSucceeds(deleteDoc(doc(as(env, 'mentorA'), `${comments}/c1`)))
  })
})
