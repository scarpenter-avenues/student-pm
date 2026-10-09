import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  arrayUnion,
  collection,
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
import { PROGRAM, as, makeEnv, seed } from './setup'

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await makeEnv()
})
beforeEach(() => seed(env))
afterAll(() => env.cleanup())

const announcement = (audience: string[], authorId: string) => ({
  title: 'Build night moved',
  body: '',
  bodyHtml: '',
  audience,
  authorId,
  postedAt: Timestamp.now(),
  emailed: false,
})

describe('announcements', () => {
  const posts = `${PROGRAM}/announcements`
  it("students see their team's and program-wide posts, not other teams'", async () => {
    const db = as(env, 'studentA')
    await assertSucceeds(getDoc(doc(db, `${posts}/a1`)))
    await assertSucceeds(getDoc(doc(db, `${posts}/a2`)))
    await assertFails(getDoc(doc(db, `${posts}/a3`)))
    await assertSucceeds(getDoc(doc(as(env, 'coach'), `${posts}/a3`)))
  })
  it('the one-query feed (array-contains-any [team, "all"]) is allowed', async () => {
    const db = as(env, 'studentA')
    await assertSucceeds(
      getDocs(
        query(
          collection(db, posts),
          where('audience', 'array-contains-any', ['teamA', 'all']),
          orderBy('postedAt', 'desc'),
        ),
      ),
    )
    await assertFails(
      getDocs(
        query(collection(db, posts), where('audience', 'array-contains-any', ['teamA', 'teamB'])),
      ),
    )
  })
  it('students and mentors post to their own teams; only coaches post to everyone', async () => {
    await assertSucceeds(
      setDoc(doc(as(env, 'studentA'), `${posts}/n1`), announcement(['teamA'], 'studentA')),
    )
    await assertFails(
      setDoc(doc(as(env, 'studentA'), `${posts}/n2`), announcement(['teamB'], 'studentA')),
    )
    await assertFails(
      setDoc(doc(as(env, 'studentA'), `${posts}/n3`), announcement(['all'], 'studentA')),
    )
    await assertFails(
      setDoc(doc(as(env, 'mentorA'), `${posts}/n4`), announcement(['all'], 'mentorA')),
    )
    await assertSucceeds(
      setDoc(doc(as(env, 'coach'), `${posts}/n5`), announcement(['all'], 'coach')),
    )
    await assertFails(
      setDoc(doc(as(env, 'studentA'), `${posts}/n6`), announcement(['teamA'], 'mentorA')),
    )
  })
  it("an author can't re-target their post to other teams or everyone", async () => {
    await assertFails(
      updateDoc(doc(as(env, 'mentorA'), `${posts}/a1`), { audience: ['teamA', 'teamB'] }),
    )
    await assertFails(updateDoc(doc(as(env, 'mentorA'), `${posts}/a1`), { audience: ['all'] }))
    await assertFails(updateDoc(doc(as(env, 'mentorA'), `${posts}/a1`), { authorId: 'coach' }))
  })
  it('authors and coaches edit; others cannot', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'mentorA'), `${posts}/a1`), { title: 'Edited' }))
    await assertFails(updateDoc(doc(as(env, 'studentA'), `${posts}/a1`), { title: 'Edited' }))
    await assertSucceeds(updateDoc(doc(as(env, 'coach'), `${posts}/a1`), { title: 'Edited again' }))
  })
})

describe('huddles (adults only)', () => {
  const huddle = `${PROGRAM}/huddles/h1`
  it('adults read; students cannot', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'mentorA'), huddle)))
    await assertFails(getDoc(doc(as(env, 'leadA'), huddle)))
    await assertFails(getDoc(doc(as(env, 'studentA'), huddle)))
  })
  it('program coaches post', async () => {
    const post = {
      kind: 'note',
      date: '2026-10-09',
      authorId: 'coach',
      postedAt: Timestamp.now(),
      text: 'Room 214 is locked',
      readBy: [],
    }
    await assertSucceeds(setDoc(doc(as(env, 'coach'), `${PROGRAM}/huddles/h2`), post))
    await assertFails(
      setDoc(doc(as(env, 'mentorA'), `${PROGRAM}/huddles/h2`), { ...post, authorId: 'mentorA' }),
    )
  })
  it('an adult marks a huddle seen for themselves only', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, 'mentorA'), huddle), { readBy: arrayUnion('mentorA') }),
    )
    await assertFails(updateDoc(doc(as(env, 'mentorA'), huddle), { readBy: arrayUnion('mentorB') }))
    await assertFails(updateDoc(doc(as(env, 'mentorA'), huddle), { status: 'Edited' }))
    await assertFails(
      updateDoc(doc(as(env, 'studentA'), huddle), { readBy: arrayUnion('studentA') }),
    )
  })
})

describe('userState', () => {
  it('only you read and write your own', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, 'studentA'), `${PROGRAM}/userState/studentA`), {
        'announcementsRead.a1': true,
      }),
    )
    await assertFails(getDoc(doc(as(env, 'studentA2'), `${PROGRAM}/userState/studentA`)))
    await assertFails(getDoc(doc(as(env, 'coach'), `${PROGRAM}/userState/studentA`)))
  })
})
