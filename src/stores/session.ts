// Who is signed in, and what they belong to: their member doc, the program, and the teams they can open.
//
// Phases: starting → signedOut, or → (verifyEmail) → joining → ready | noAccess | failed.
// Joining = finding the person's member doc, or claiming their invite on first sign-in (see docs/data-model.md).
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import {
  clearIndexedDbPersistence,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  terminate,
  where,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db, programId } from '@/firebase'
import { emailDomain, isGoogleEmail, signInMethodFor } from '@/model/signIn'
import {
  ADULT_ROLES,
  type Invite,
  type Member,
  type Program,
  type PublicSignIn,
  type Team,
  type WithId,
} from '@/model/types'
import { authMessage } from '@/auth/messages'

export type Phase =
  'starting' | 'signedOut' | 'verifyEmail' | 'joining' | 'ready' | 'noAccess' | 'failed'

const programDoc = () => doc(db, 'programs', programId)
const isDenied = (error: unknown) => (error as FirestoreError)?.code === 'permission-denied'

export const useSession = defineStore('session', () => {
  const phase = ref<Phase>('starting')
  const user = shallowRef<User | null>(null)
  const member = ref<WithId<Member> | null>(null)
  const program = ref<Program | null>(null)
  const teamsById = ref<Record<string, WithId<Team>>>({})
  /** The program's name and sign-in methods (readable before sign-in). */
  const signIn = ref<PublicSignIn | null>(null)
  /** A message for the sign-in page, e.g. "use your school account". */
  const notice = ref('')

  const role = computed(() => member.value?.role ?? null)
  const isCoach = computed(() => role.value === 'coach')
  const isAdult = computed(() => !!role.value && ADULT_ROLES.includes(role.value))
  /** The teams this person can open, by name. Program coaches: every team in the current season. */
  const teams = computed(() =>
    Object.values(teamsById.value).sort((a, b) => a.name.localeCompare(b.name)),
  )

  // ---------- listeners ----------
  let stops: Unsubscribe[] = []
  let teamStops: Unsubscribe[] = []
  let teamsKey = ''
  const stopTeams = () => {
    teamStops.forEach((stop) => stop())
    teamStops = []
    teamsKey = ''
  }
  const stopAll = () => {
    stops.forEach((stop) => stop())
    stops = []
    stopTeams()
  }

  function onListenError(error: FirestoreError) {
    stopAll()
    // Removed from the program while signed in: the rules stop letting us read.
    if (isDenied(error)) phase.value = 'noAccess'
    else fail(error)
  }

  function listen(uid: string) {
    stops.push(
      onSnapshot(
        programDoc(),
        (snap) => {
          program.value = (snap.data() as Program | undefined) ?? null
          markReady()
        },
        onListenError,
      ),
      onSnapshot(
        doc(db, 'programs', programId, 'members', uid),
        (snap) => {
          if (!snap.exists()) {
            stopAll()
            member.value = null
            phase.value = 'noAccess'
            return
          }
          member.value = { id: snap.id, ...(snap.data() as Member) }
          markReady()
        },
        onListenError,
      ),
    )
  }

  function markReady() {
    if (member.value && program.value && phase.value === 'joining') phase.value = 'ready'
  }

  // Teams follow the member doc (and, for program coaches, the current season).
  watch(
    () => [
      phase.value,
      role.value,
      member.value?.teamIds.join('|'),
      program.value?.currentSeasonId,
    ],
    () => {
      if (phase.value !== 'ready' || !member.value || !program.value) return
      const key = isCoach.value
        ? `season:${program.value.currentSeasonId}`
        : `teams:${member.value.teamIds.join('|')}`
      if (key === teamsKey) return
      stopTeams()
      teamsKey = key
      teamsById.value = {}
      const keep = (id: string, data: Team | undefined) => {
        const next = { ...teamsById.value }
        if (data) next[id] = { id, ...data }
        else delete next[id]
        teamsById.value = next
      }
      if (isCoach.value) {
        const season = query(
          collection(db, 'programs', programId, 'teams'),
          where('seasonIds', 'array-contains', program.value.currentSeasonId),
        )
        teamStops.push(
          onSnapshot(
            season,
            (snap) => {
              teamsById.value = Object.fromEntries(
                snap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Team) }]),
              )
            },
            onListenError,
          ),
        )
      } else {
        member.value.teamIds.forEach((teamId) => {
          teamStops.push(
            onSnapshot(
              doc(db, 'programs', programId, 'teams', teamId),
              (snap) => keep(teamId, snap.data() as Team | undefined),
              onListenError,
            ),
          )
        })
      }
    },
  )

  // ---------- joining ----------
  let run = 0

  async function loadSignIn(): Promise<PublicSignIn | null> {
    if (!signIn.value) {
      const snap = await getDoc(doc(db, 'programs', programId, 'public', 'signIn'))
      signIn.value = (snap.data() as PublicSignIn | undefined) ?? null
    }
    return signIn.value
  }

  async function isMember(uid: string): Promise<boolean> {
    try {
      return (await getDoc(doc(db, 'programs', programId, 'members', uid))).exists()
    } catch (error) {
      // Non-members can't read the roster, including their own (missing) member doc.
      if (isDenied(error)) return false
      throw error
    }
  }

  /** First sign-in: turn the invite for this email into a member doc (the rules check they match). */
  async function claimInvite(next: User, email: string, provider: string): Promise<boolean> {
    const inviteRef = doc(db, 'programs', programId, 'invites', email)
    const snap = await getDoc(inviteRef).catch((error) => {
      if (isDenied(error)) return null
      throw error
    })
    if (!snap?.exists()) return false
    const invite = snap.data() as Invite
    const method = signInMethodFor(signIn.value!.auth, email, invite.role)
    if (method !== (provider === 'google.com' ? 'google' : 'password')) {
      notice.value =
        method === 'google'
          ? `${emailDomain(email)} accounts sign in with Google.`
          : 'Your coach added you with an email that can’t sign in here. Ask them to check it.'
      return false
    }
    const userRef = doc(db, 'users', next.uid)
    const batch = writeBatch(db)
    batch.set(doc(db, 'programs', programId, 'members', next.uid), {
      displayName: invite.displayName,
      role: invite.role,
      teamIds: invite.teamIds,
      subteams: invite.subteams,
      joinedAt: serverTimestamp(),
    })
    // users/{uid} is written once; someone removed and later re-added already has it.
    if (!(await getDoc(userRef)).exists()) batch.set(userRef, { programId })
    batch.delete(inviteRef)
    await batch.commit()
    return true
  }

  async function handleUser(next: User | null) {
    const mine = ++run
    const hadData = phase.value === 'ready'
    stopAll()
    user.value = next
    member.value = null
    program.value = null
    teamsById.value = {}
    if (!next) {
      // Signed out (here or in another tab): don't leave this person's cached data on a shared device.
      if (hadData) return wipeAndReload()
      phase.value = 'signedOut'
      return
    }
    const email = next.email?.toLowerCase() ?? ''
    const provider = (await next.getIdTokenResult()).signInProvider ?? ''
    if (mine !== run) return
    if (provider === 'password' && !next.emailVerified) {
      phase.value = 'verifyEmail'
      return
    }
    phase.value = 'joining'
    try {
      const settings = await loadSignIn()
      if (mine !== run) return
      if (!settings) throw new Error('This program isn’t set up yet. Run `npm run setup` first.')
      // The wrong kind of account: a Google account off the program's domains, or a password on them.
      const onDomain = isGoogleEmail(settings.auth, email)
      if (provider === 'google.com' && !onDomain) {
        const domains = settings.auth.google?.domains ?? []
        return reject(
          domains.length
            ? `${email} can’t sign in with Google here. Use your ${domains.join(' or ')} account${settings.auth.password ? ', or sign in with your email and password' : ''}.`
            : 'This program doesn’t use Google sign-in.',
        )
      }
      if (provider === 'password' && onDomain) {
        return reject(`${emailDomain(email)} accounts sign in with Google.`)
      }
      notice.value = ''
      const joined = (await isMember(next.uid)) || (await claimInvite(next, email, provider))
      if (mine !== run) return
      if (!joined) {
        phase.value = 'noAccess'
        return
      }
      listen(next.uid)
    } catch (error) {
      if (mine === run) fail(error)
    }
  }

  const problem = ref('')
  function fail(error: unknown) {
    console.error(error)
    problem.value = error instanceof Error ? error.message : String(error)
    phase.value = 'failed'
  }

  async function reject(message: string) {
    await firebaseSignOut(auth)
    notice.value = message
  }

  async function wipeAndReload() {
    await terminate(db)
    // Fails if another tab still has the cache open; that tab clears it when it sees the sign-out.
    await clearIndexedDbPersistence(db).catch(() => {})
    window.location.assign('/sign-in')
  }

  // ---------- actions ----------
  let started: Promise<void> | null = null
  /** Starts watching sign-in state; resolves once the first answer is in. */
  function start(): Promise<void> {
    started ??= new Promise((resolve) => {
      onAuthStateChanged(auth, (next) => void handleUser(next).finally(resolve))
    })
    return started
  }

  /** Resolves when the phase is no longer starting or joining. */
  function settled(): Promise<void> {
    return new Promise((resolve) => {
      const stop = watch(
        phase,
        (value) => {
          if (value === 'starting' || value === 'joining') return
          queueMicrotask(() => stop())
          resolve()
        },
        { immediate: true },
      )
    })
  }

  /** Runs a sign-in action; returns an error message for the page, or null. */
  async function attempt(action: () => Promise<unknown>): Promise<string | null> {
    notice.value = ''
    try {
      await action()
      return null
    } catch (error) {
      return authMessage(error)
    }
  }

  const passwordRefusal = (email: string) =>
    signIn.value && isGoogleEmail(signIn.value.auth, email)
      ? `${emailDomain(email)} accounts sign in with Google.`
      : null

  function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    const domains = signIn.value?.auth.google?.domains ?? []
    // `hd` asks Google to show only accounts on the domain (a hint; the rules enforce it).
    provider.setCustomParameters({
      prompt: 'select_account',
      ...(domains.length === 1 ? { hd: domains[0]! } : {}),
    })
    return attempt(() => signInWithPopup(auth, provider))
  }

  async function signInWithPassword(email: string, password: string) {
    return (
      passwordRefusal(email) ?? attempt(() => signInWithEmailAndPassword(auth, email, password))
    )
  }

  async function createPassword(email: string, password: string) {
    if (password.length < 8) return 'Use at least 8 characters.'
    return (
      passwordRefusal(email) ??
      attempt(async () => {
        const { user: created } = await createUserWithEmailAndPassword(auth, email, password)
        await sendEmailVerification(created)
      })
    )
  }

  async function resetPassword(email: string) {
    return passwordRefusal(email) ?? attempt(() => sendPasswordResetEmail(auth, email))
  }

  function resendVerification() {
    return attempt(async () => {
      if (auth.currentUser) await sendEmailVerification(auth.currentUser)
    })
  }

  /** After the person clicks the link in their email. */
  async function checkVerified(): Promise<boolean> {
    const current = auth.currentUser
    if (!current) return false
    await current.reload()
    if (!current.emailVerified) return false
    await current.getIdToken(true) // the rules read email_verified from the token
    await handleUser(current)
    return true
  }

  function signOut() {
    return firebaseSignOut(auth)
  }

  return {
    phase,
    user,
    member,
    program,
    teams,
    teamsById,
    signIn,
    notice,
    problem,
    role,
    isCoach,
    isAdult,
    start,
    settled,
    loadSignIn,
    signInWithGoogle,
    signInWithPassword,
    createPassword,
    resetPassword,
    resendVerification,
    checkVerified,
    signOut,
  }
})
