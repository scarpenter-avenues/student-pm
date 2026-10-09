import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { PROGRAM, as, asNewcomer, invite, makeEnv, seed } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await makeEnv()
})
beforeEach(() => seed(env))
afterAll(() => env.cleanup())

describe('program', () => {
  it('members can read the program; outsiders cannot', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'studentA'), PROGRAM)))
    await assertFails(getDoc(doc(asNewcomer(env, 'stranger', 'stranger@example.edu'), PROGRAM)))
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore() as never, PROGRAM)))
  })
  it("anyone can read the sign-in page's public doc; only program coaches change it", async () => {
    const path = `${PROGRAM}/public/signIn`
    const anonymous = env.unauthenticatedContext().firestore() as never
    await assertSucceeds(getDoc(doc(anonymous, path)))
    await assertSucceeds(updateDoc(doc(as(env, 'coach'), path), { name: 'Renamed' }))
    await assertFails(updateDoc(doc(as(env, 'mentorA'), path), { name: 'Renamed' }))
    await assertFails(setDoc(doc(anonymous, path), { name: 'Renamed', auth: {} }))
  })
  it('only program coaches change program settings', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'coach'), PROGRAM), { name: 'Renamed' }))
    await assertFails(updateDoc(doc(as(env, 'mentorA'), PROGRAM), { name: 'Renamed' }))
    await assertFails(updateDoc(doc(as(env, 'studentA'), PROGRAM), { name: 'Renamed' }))
  })
})

describe('members (roster)', () => {
  const member = (uid: string) => `${PROGRAM}/members/${uid}`
  it('any member can read the roster', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'studentB'), member('studentA'))))
  })
  it('nobody edits their own member doc (no self-promotion)', async () => {
    await assertFails(updateDoc(doc(as(env, 'studentA'), member('studentA')), { role: 'lead' }))
    await assertFails(
      updateDoc(doc(as(env, 'mentorA'), member('mentorA')), { teamIds: ['teamA', 'teamB'] }),
    )
  })
  it('team leads change only subteam assignments, only on their team', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, 'leadA'), member('studentA')), { subteams: { teamA: ['mech'] } }),
    )
    await assertFails(updateDoc(doc(as(env, 'leadA'), member('studentA')), { role: 'lead' }))
    await assertFails(
      updateDoc(doc(as(env, 'leadA'), member('studentB')), { subteams: { teamB: ['mech'] } }),
    )
  })
  it("mentors manage students and leads on their own teams, but can't make adults", async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'mentorA'), member('studentA')), { role: 'lead' }))
    await assertFails(updateDoc(doc(as(env, 'mentorA'), member('studentB')), { role: 'lead' }))
    await assertFails(updateDoc(doc(as(env, 'mentorA'), member('studentA')), { role: 'coach' }))
    await assertFails(
      updateDoc(doc(as(env, 'mentorA'), member('studentA')), { teamIds: ['teamB'] }),
    )
  })
  it('program coaches manage anyone', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, 'coach'), member('mentorB')), { teamIds: ['teamA', 'teamB'] }),
    )
    await assertSucceeds(deleteDoc(doc(as(env, 'coach'), member('studentB'))))
  })
  it('contact emails are coach-only', async () => {
    const contact = `${member('studentA')}/private/contact`
    await assertSucceeds(getDoc(doc(as(env, 'coach'), contact)))
    await assertFails(getDoc(doc(as(env, 'mentorA'), contact)))
    await assertFails(getDoc(doc(as(env, 'studentA'), contact)))
  })
})

describe('invites and first sign-in', () => {
  const claim = async (
    db: ReturnType<typeof as>,
    uid: string,
    email: string,
    overrides: Record<string, unknown> = {},
  ) => {
    const snap = await getDoc(doc(db, `${PROGRAM}/invites/${email}`))
    const data = snap.data() ?? invite(email, 'student', ['teamA'])
    const batch = writeBatch(db)
    batch.set(doc(db, `${PROGRAM}/members/${uid}`), {
      displayName: data.displayName,
      role: data.role,
      teamIds: data.teamIds,
      subteams: data.subteams,
      joinedAt: serverTimestamp(),
      ...overrides,
    })
    batch.set(doc(db, `users/${uid}`), { programId: 'p1' })
    batch.delete(doc(db, `${PROGRAM}/invites/${email}`))
    return batch.commit()
  }

  it('a student on the Google domain claims their invite', async () => {
    await assertSucceeds(
      claim(
        asNewcomer(env, 'riley', 'new.student@example.edu'),
        'riley',
        'new.student@example.edu',
      ),
    )
  })
  it("can't change the invite while claiming it", async () => {
    await assertFails(
      claim(
        asNewcomer(env, 'riley', 'new.student@example.edu'),
        'riley',
        'new.student@example.edu',
        { role: 'coach' },
      ),
    )
    await assertFails(
      claim(
        asNewcomer(env, 'riley', 'new.student@example.edu'),
        'riley',
        'new.student@example.edu',
        { teamIds: ['teamA', 'teamB'] },
      ),
    )
  })
  it('an outside mentor claims with email/password (allowed for mentors)', async () => {
    await assertSucceeds(
      claim(
        asNewcomer(env, 'vol', 'volunteer@gmail.com', { provider: 'password' }),
        'vol',
        'volunteer@gmail.com',
      ),
    )
  })
  it("a Google account outside the program's domains can't join", async () => {
    await assertFails(
      claim(
        asNewcomer(env, 'vol', 'volunteer@gmail.com', { provider: 'google.com' }),
        'vol',
        'volunteer@gmail.com',
      ),
    )
  })
  it("a student can't use email/password (only mentors and coaches may)", async () => {
    await assertFails(
      claim(
        asNewcomer(env, 'kid', 'kid@gmail.com', { provider: 'password' }),
        'kid',
        'kid@gmail.com',
      ),
    )
  })
  it('a school email must use Google, not a separate password account', async () => {
    await assertFails(
      claim(
        asNewcomer(env, 't', 'teacher@example.edu', { provider: 'password' }),
        't',
        'teacher@example.edu',
      ),
    )
    await assertSucceeds(
      claim(asNewcomer(env, 't', 'teacher@example.edu'), 't', 'teacher@example.edu'),
    )
  })
  it('an unverified email cannot join', async () => {
    await assertFails(
      claim(
        asNewcomer(env, 'vol', 'volunteer@gmail.com', { provider: 'password', verified: false }),
        'vol',
        'volunteer@gmail.com',
      ),
    )
  })
  it('you can read only your own invite, by its path (what the app does at sign-in)', async () => {
    const db = asNewcomer(env, 'riley', 'new.student@example.edu')
    await assertSucceeds(getDoc(doc(db, `${PROGRAM}/invites/new.student@example.edu`)))
    await assertFails(getDoc(doc(db, `${PROGRAM}/invites/kid@gmail.com`)))
    const unverified = asNewcomer(env, 'riley', 'new.student@example.edu', { verified: false })
    await assertFails(getDoc(doc(unverified, `${PROGRAM}/invites/new.student@example.edu`)))
  })
  it('you can find only your own invite (collection-group lookup at sign-in)', async () => {
    const db = asNewcomer(env, 'riley', 'new.student@example.edu')
    await assertSucceeds(
      getDocs(
        query(collectionGroup(db, 'invites'), where('email', '==', 'new.student@example.edu')),
      ),
    )
    await assertFails(
      getDocs(query(collectionGroup(db, 'invites'), where('email', '==', 'kid@gmail.com'))),
    )
  })
  it('mentors invite students to their own teams only; students cannot invite', async () => {
    await assertSucceeds(
      setDoc(
        doc(as(env, 'mentorA'), `${PROGRAM}/invites/sam@example.edu`),
        invite('sam@example.edu', 'student', ['teamA']),
      ),
    )
    await assertFails(
      setDoc(
        doc(as(env, 'mentorA'), `${PROGRAM}/invites/sam@example.edu`),
        invite('sam@example.edu', 'student', ['teamB']),
      ),
    )
    await assertFails(
      setDoc(
        doc(as(env, 'mentorA'), `${PROGRAM}/invites/sam@example.edu`),
        invite('sam@example.edu', 'mentor', ['teamA']),
      ),
    )
    await assertFails(
      setDoc(
        doc(as(env, 'studentA'), `${PROGRAM}/invites/sam@example.edu`),
        invite('sam@example.edu', 'student', ['teamA']),
      ),
    )
  })
  it("a mentor can't pull another team's invite onto their own team", async () => {
    await assertSucceeds(
      setDoc(
        doc(as(env, 'coach'), `${PROGRAM}/invites/b.kid@example.edu`),
        invite('b.kid@example.edu', 'student', ['teamB']),
      ),
    )
    await assertFails(
      setDoc(
        doc(as(env, 'mentorA'), `${PROGRAM}/invites/b.kid@example.edu`),
        invite('b.kid@example.edu', 'student', ['teamA']),
      ),
    )
    await assertSucceeds(
      setDoc(doc(as(env, 'mentorA'), `${PROGRAM}/invites/new.student@example.edu`), {
        ...invite('new.student@example.edu', 'lead', ['teamA']),
      }),
    )
  })
  it("the invite's id must be its email", async () => {
    await assertFails(
      setDoc(
        doc(as(env, 'coach'), `${PROGRAM}/invites/someone-else@example.edu`),
        invite('sam@example.edu', 'student', ['teamA']),
      ),
    )
  })
  it("users/{uid} can only be created once you're a member", async () => {
    await assertFails(
      setDoc(doc(asNewcomer(env, 'stranger', 'stranger@example.edu'), 'users/stranger'), {
        programId: 'p1',
      }),
    )
  })
})
