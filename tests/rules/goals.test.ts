import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { PROGRAM, as, makeEnv, seed } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await makeEnv()
})
beforeEach(() => seed(env))
afterAll(() => env.cleanup())

const goal = `${PROGRAM}/goals/g1`
const summary = `${PROGRAM}/goalSummaries/g1`
const events = `${goal}/events`

describe('goal privacy', () => {
  it('teammates see the statement and status (summary) but not the goal itself', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'studentA2'), summary)))
    await assertFails(getDoc(doc(as(env, 'studentA2'), goal)))
    await assertFails(getDoc(doc(as(env, 'leadA'), goal)))
  })
  it("other teams don't see the summary either", async () => {
    await assertFails(getDoc(doc(as(env, 'studentB'), summary)))
  })
  it("the student, their team's mentors, and coaches see the goal", async () => {
    await assertSucceeds(getDoc(doc(as(env, 'studentA'), goal)))
    await assertSucceeds(getDoc(doc(as(env, 'mentorA'), goal)))
    await assertSucceeds(getDoc(doc(as(env, 'coach'), goal)))
    await assertFails(getDoc(doc(as(env, 'mentorB'), goal)))
  })
  it('team goal cards and My goals queries are allowed', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(as(env, 'studentA2'), `${PROGRAM}/goalSummaries`),
          where('teamId', '==', 'teamA'),
          where('state', '==', 'active'),
        ),
      ),
    )
    await assertSucceeds(
      getDocs(
        query(
          collection(as(env, 'studentA'), `${PROGRAM}/goals`),
          where('studentId', '==', 'studentA'),
        ),
      ),
    )
    await assertSucceeds(
      getDocs(
        query(collection(as(env, 'mentorA'), `${PROGRAM}/goals`), where('teamId', 'in', ['teamA'])),
      ),
    )
    await assertFails(
      getDocs(
        query(collection(as(env, 'mentorA'), `${PROGRAM}/goals`), where('teamId', '==', 'teamB')),
      ),
    )
  })
})

describe('writing goals', () => {
  const newGoal = (overrides: Record<string, unknown> = {}) => ({
    studentId: 'studentA',
    teamId: 'teamA',
    createdTeamId: 'teamA',
    seasonId: '2026-27',
    wish: 'learn Java for FTC',
    evidence: 'I write a working tele-op',
    obstacle: 'I forget syntax',
    plan: 'If I forget, then I check my notes',
    by: { label: 'End of Sprint 5', date: '2026-11-15' },
    status: "Haven't started",
    state: 'active',
    createdAt: Timestamp.now(),
    finishedAt: null,
    pausedAt: null,
    reflection: null,
    lastCheckinAt: null,
    unreadFeedback: 0,
    ...overrides,
  })
  it('a student creates a goal and its summary together', async () => {
    const db = as(env, 'studentA')
    const batch = writeBatch(db)
    batch.set(doc(db, `${PROGRAM}/goals/g2`), newGoal())
    batch.set(doc(db, `${PROGRAM}/goalSummaries/g2`), {
      studentId: 'studentA',
      teamId: 'teamA',
      seasonId: '2026-27',
      statement: 'Learn Java for FTC',
      status: "Haven't started",
      state: 'active',
    })
    await assertSucceeds(batch.commit())
  })
  it("a student can't create a goal for someone else or on another team", async () => {
    await assertFails(
      setDoc(doc(as(env, 'studentA'), `${PROGRAM}/goals/g2`), newGoal({ studentId: 'studentA2' })),
    )
    await assertFails(
      setDoc(doc(as(env, 'studentA'), `${PROGRAM}/goals/g2`), newGoal({ teamId: 'teamB' })),
    )
  })
  it("a student can't show their summary to another team", async () => {
    await assertFails(updateDoc(doc(as(env, 'studentA'), summary), { teamId: 'teamB' }))
    await assertSucceeds(updateDoc(doc(as(env, 'studentA'), summary), { status: 'Almost there' }))
  })
  it("a summary can't be written for someone else's goal", async () => {
    await assertFails(updateDoc(doc(as(env, 'studentA2'), summary), { status: 'Got it' }))
  })
  it('the student updates their goal but not its team', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'studentA'), goal), { status: 'Almost there' }))
    await assertFails(updateDoc(doc(as(env, 'studentA'), goal), { teamId: 'teamB' }))
  })
  it('mentors only touch the unread-feedback count; coaches move goals between teams', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'mentorA'), goal), { unreadFeedback: 1 }))
    await assertFails(updateDoc(doc(as(env, 'mentorA'), goal), { plan: 'A better plan' }))
    await assertSucceeds(updateDoc(doc(as(env, 'coach'), goal), { teamId: 'teamB' }))
  })
})

describe('goal history (events)', () => {
  it('the student and program coaches see everything', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'studentA'), `${events}/e2`)))
    await assertSucceeds(getDoc(doc(as(env, 'coach'), `${events}/e2`)))
  })
  it("a mentor sees only what was written while the student was on the mentor's team", async () => {
    await assertSucceeds(getDoc(doc(as(env, 'mentorA'), `${events}/e1`)))
    await assertFails(getDoc(doc(as(env, 'mentorA'), `${events}/e2`)))
    await assertSucceeds(
      getDocs(query(collection(as(env, 'mentorA'), events), where('teamId', '==', 'teamA'))),
    )
    await assertFails(getDocs(collection(as(env, 'mentorA'), events)))
  })
  it('teammates see none of it', async () => {
    await assertFails(getDoc(doc(as(env, 'studentA2'), `${events}/e1`)))
  })
  it('the student writes check-ins and replies; only adults write feedback', async () => {
    const entry = (type: string, authorId: string, teamId = 'teamA') => ({
      type,
      authorId,
      teamId,
      date: '2026-10-09',
      createdAt: Timestamp.now(),
      text: 'Note',
    })
    await assertSucceeds(
      setDoc(doc(as(env, 'studentA'), `${events}/e3`), entry('checkin', 'studentA')),
    )
    await assertSucceeds(
      setDoc(doc(as(env, 'studentA'), `${events}/e4`), entry('reply', 'studentA')),
    )
    await assertFails(
      setDoc(doc(as(env, 'studentA'), `${events}/e5`), entry('feedback', 'studentA')),
    )
    await assertSucceeds(
      setDoc(doc(as(env, 'mentorA'), `${events}/e6`), entry('feedback', 'mentorA')),
    )
    await assertFails(
      setDoc(doc(as(env, 'mentorA'), `${events}/e7`), entry('feedback', 'mentorA', 'teamB')),
    )
    await assertFails(
      setDoc(doc(as(env, 'mentorB'), `${events}/e8`), entry('feedback', 'mentorB', 'teamB')),
    )
    await assertFails(
      setDoc(doc(as(env, 'studentA2'), `${events}/e9`), entry('checkin', 'studentA2')),
    )
  })
  it('history is append-only', async () => {
    await assertFails(updateDoc(doc(as(env, 'studentA'), `${events}/e1`), { status: 'Got it' }))
    await assertFails(updateDoc(doc(as(env, 'coach'), `${events}/e1`), { status: 'Got it' }))
  })
})
