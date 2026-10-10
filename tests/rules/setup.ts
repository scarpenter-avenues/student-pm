// Shared setup for the Firestore security rules tests (run with `npm run test:rules`, which starts the emulator).
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore'

export const PROGRAM = 'programs/p1'

type Person = {
  role: 'student' | 'lead' | 'mentor' | 'coach'
  teamIds: string[]
  email: string
  provider?: 'google.com' | 'password'
}

/** Everyone in the sample program, keyed by uid. teamA and teamB are the two teams. */
export const people = {
  coach: { role: 'coach', teamIds: [], email: 'coach@example.edu' },
  mentorA: { role: 'mentor', teamIds: ['teamA'], email: 'mentor.a@example.edu' },
  // An outside volunteer: email/password, which the program allows for mentors and coaches.
  mentorB: {
    role: 'mentor',
    teamIds: ['teamB'],
    email: 'volunteer.b@gmail.com',
    provider: 'password',
  },
  leadA: { role: 'lead', teamIds: ['teamA'], email: 'lead.a@example.edu' },
  studentA: { role: 'student', teamIds: ['teamA'], email: 'student.a@example.edu' },
  studentA2: { role: 'student', teamIds: ['teamA'], email: 'student.a2@example.edu' },
  studentB: { role: 'student', teamIds: ['teamB'], email: 'student.b@example.edu' },
} satisfies Record<string, Person>

export type Uid = keyof typeof people

export function makeEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    // Its own project, so the tests never clear the demo data in a running `npm start`.
    projectId: 'demo-switchback-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
}

/** Firestore as a member of the sample program. */
export function as(env: RulesTestEnvironment, uid: Uid): Firestore {
  const person: Person = people[uid]
  return env
    .authenticatedContext(uid, {
      email: person.email,
      email_verified: true,
      firebase: { sign_in_provider: person.provider ?? 'google.com' },
    })
    .firestore() as unknown as Firestore
}

/** Firestore as someone who has signed in but isn't in the program yet (e.g. claiming an invite). */
export function asNewcomer(
  env: RulesTestEnvironment,
  uid: string,
  email: string,
  {
    provider = 'google.com',
    verified = true,
  }: { provider?: 'google.com' | 'password'; verified?: boolean } = {},
): Firestore {
  return env
    .authenticatedContext(uid, {
      email,
      email_verified: verified,
      firebase: { sign_in_provider: provider },
    })
    .firestore() as unknown as Firestore
}

/** A valid task for teamA; override any field. */
export function task(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Prototype claw fingers',
    type: 'Task',
    status: 'To do',
    sprintId: 's3',
    rank: 'a0',
    subteamIds: ['mech'],
    assigneeIds: ['studentA'],
    start: null,
    due: null,
    descriptionHtml: '',
    subtasks: [],
    goalId: null,
    github: null,
    archived: null,
    createdBy: 'studentA',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  }
}

export function invite(email: string, role: Person['role'], teamIds: string[]) {
  return {
    email,
    displayName: 'Riley T.',
    role,
    teamIds,
    subteams: {},
    invitedBy: 'coach',
    invitedAt: Timestamp.now(),
  }
}

/** Resets the emulator to the sample program. */
export async function seed(env: RulesTestEnvironment) {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore
    const set = (path: string, data: Record<string, unknown>) => setDoc(doc(db, path), data)
    const writes: Promise<void>[] = [
      set(PROGRAM, {
        name: 'Example Robotics',
        auth: { google: { domains: ['example.edu'] }, password: { roles: ['mentor', 'coach'] } },
        subteamDefaults: [],
        currentSeasonId: '2026-27',
      }),
      set(`${PROGRAM}/public/signIn`, {
        name: 'Example Robotics',
        auth: { google: { domains: ['example.edu'] }, password: { roles: ['mentor', 'coach'] } },
      }),
      set(`${PROGRAM}/seasons/2026-27`, {
        name: '2026–27',
        start: '2026-09-01',
        end: '2027-03-31',
      }),
      ...Object.entries(people).map(([uid, person]) =>
        set(`${PROGRAM}/members/${uid}`, {
          displayName: uid,
          role: person.role,
          teamIds: person.teamIds,
          subteams: {},
          joinedAt: Timestamp.now(),
        }),
      ),
      set(`${PROGRAM}/members/studentA/private/contact`, { email: people.studentA.email }),
      ...['teamA', 'teamB'].map((teamId) =>
        set(`${PROGRAM}/teams/${teamId}`, {
          name: teamId,
          number: teamId === 'teamA' ? '418' : '7731',
          color: 'green',
          sprintDays: 14,
          seasonIds: ['2026-27'],
          subteams: [],
          github: { repo: null, importIssues: true, closeOnDone: true },
          createdAt: Timestamp.now(),
        }),
      ),
      set(`${PROGRAM}/teams/teamA/sprints/s3`, {
        seasonId: '2026-27',
        name: 'Sprint 3',
        index: 2,
        start: '2026-10-02',
        end: '2026-10-17',
        objectives: [],
      }),
      set(`${PROGRAM}/teams/teamA/tasks/t1`, task()),
      set(
        `${PROGRAM}/teams/teamA/tasks/archived1`,
        task({ archived: { by: 'studentA', at: Timestamp.now(), from: 'Sprint 3' } }),
      ),
      set(
        `${PROGRAM}/teams/teamA/tasks/issue1`,
        task({
          type: 'GitHub issue',
          github: {
            repo: 'example/robot',
            number: 12,
            url: 'https://github.com/example/robot/issues/12',
            state: 'open',
          },
        }),
      ),
      set(`${PROGRAM}/teams/teamA/tasks/t1/comments/c1`, {
        authorId: 'studentA',
        text: 'Printed shape A',
        subtaskId: null,
        createdAt: Timestamp.now(),
      }),
      set(
        `${PROGRAM}/teams/teamB/tasks/t2`,
        task({ createdBy: 'studentB', assigneeIds: ['studentB'] }),
      ),
      set(`${PROGRAM}/teams/teamA/events/q1`, {
        title: 'Qualifier 2',
        date: '2026-11-08',
        time: '',
        location: '',
        type: 'Competition',
        conditional: false,
      }),
      set(`${PROGRAM}/teams/teamA/pages/home`, {
        html: '<p>Build night notes</p>',
        updatedBy: 'leadA',
        updatedAt: Timestamp.now(),
      }),
      set(`${PROGRAM}/announcements/a1`, {
        title: 'Team A news',
        body: '',
        bodyHtml: '',
        audience: ['teamA'],
        authorId: 'mentorA',
        postedAt: Timestamp.now(),
        emailed: false,
      }),
      set(`${PROGRAM}/announcements/a2`, {
        title: 'Everyone',
        body: '',
        bodyHtml: '',
        audience: ['all'],
        authorId: 'coach',
        postedAt: Timestamp.now(),
        emailed: false,
      }),
      set(`${PROGRAM}/announcements/a3`, {
        title: 'Team B news',
        body: '',
        bodyHtml: '',
        audience: ['teamB'],
        authorId: 'mentorB',
        postedAt: Timestamp.now(),
        emailed: false,
      }),
      set(`${PROGRAM}/huddles/h1`, {
        kind: 'huddle',
        date: '2026-10-09',
        authorId: 'coach',
        postedAt: Timestamp.now(),
        status: 'Good energy',
        readBy: [],
      }),
      // studentA's goal. e2 is feedback from teamB's mentor, written when studentA was on teamB.
      set(`${PROGRAM}/goalSummaries/g1`, {
        studentId: 'studentA',
        teamId: 'teamA',
        seasonId: '2026-27',
        statement: 'Design parts in Onshape',
        status: 'Making progress',
        state: 'active',
      }),
      set(`${PROGRAM}/goals/g1`, {
        studentId: 'studentA',
        teamId: 'teamA',
        createdTeamId: 'teamB',
        seasonId: '2026-27',
        wish: 'design parts in Onshape',
        evidence: 'A bracket I designed gets used',
        obstacle: 'Tutorials get confusing',
        plan: 'If a tutorial gets confusing, then I ask Jordan',
        by: { label: 'Qualifier 2', date: '2026-11-08' },
        status: 'Making progress',
        state: 'active',
        createdAt: Timestamp.now(),
        finishedAt: null,
        pausedAt: null,
        reflection: null,
        lastCheckinAt: '2026-09-15',
        unreadFeedback: 0,
        lastFeedbackAt: '2026-08-01',
      }),
      set(`${PROGRAM}/goals/g1/events/e1`, {
        type: 'checkin',
        authorId: 'studentA',
        teamId: 'teamA',
        date: '2026-09-15',
        createdAt: Timestamp.now(),
        status: 'Making progress',
      }),
      set(`${PROGRAM}/goals/g1/events/e2`, {
        type: 'feedback',
        authorId: 'mentorB',
        teamId: 'teamB',
        date: '2026-08-01',
        createdAt: Timestamp.now(),
        text: 'Nice start',
      }),
      set(
        `${PROGRAM}/invites/new.student@example.edu`,
        invite('new.student@example.edu', 'student', ['teamA']),
      ),
      set(
        `${PROGRAM}/invites/volunteer@gmail.com`,
        invite('volunteer@gmail.com', 'mentor', ['teamA']),
      ),
      set(`${PROGRAM}/invites/kid@gmail.com`, invite('kid@gmail.com', 'student', ['teamA'])),
      set(
        `${PROGRAM}/invites/teacher@example.edu`,
        invite('teacher@example.edu', 'mentor', ['teamA']),
      ),
      set(`${PROGRAM}/userState/studentA`, { announcementsRead: {}, dismissed: {} }),
    ]
    await Promise.all(writes)
  })
}
