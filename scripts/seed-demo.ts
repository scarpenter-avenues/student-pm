// npm run seed:demo   (emulators must be running: `npm run emulators` or `npm start`)
//
// Replaces everything in the local emulators with the mock-up's sample program, "Example Robotics", including a
// sign-in account for every sample person. Emulator only: it refuses to touch a real Firebase project.
import { checkEmulator, connectAdmin, EMULATOR_PROJECT } from './lib/admin'
import { buildDemo, DEMO_PASSWORD, DEMO_PROGRAM_ID } from './demo/data'
import { todayIso } from '../src/model/dates'

async function clearEmulators() {
  const firestore = process.env.FIRESTORE_EMULATOR_HOST
  const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST
  await fetch(
    `http://${firestore}/emulator/v1/projects/${EMULATOR_PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  await fetch(`http://${auth}/emulator/v1/projects/${EMULATOR_PROJECT}/accounts`, {
    method: 'DELETE',
  })
}

async function main() {
  const { db, auth } = connectAdmin({ emulator: true })
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Refusing to seed: not connected to the emulators.')
  await checkEmulator()
  await clearEmulators()

  const { docs, users } = buildDemo(todayIso())
  const writer = db.bulkWriter()
  docs.forEach(([path, data]) => void writer.set(db.doc(path), data))
  await writer.close()

  // Sign-in accounts. School accounts use Google (pick them in the emulator's sign-in pop-up);
  // the outside volunteer mentor uses email and password.
  const google = users.filter((user) => user.provider === 'google.com')
  const result = await auth.importUsers(
    google.map((user) => ({
      uid: user.uid,
      email: user.email,
      emailVerified: true,
      displayName: user.displayName,
      providerData: [
        {
          uid: `google-${user.uid}`,
          email: user.email,
          displayName: user.displayName,
          providerId: 'google.com',
        },
      ],
    })),
  )
  if (result.failureCount)
    throw new Error(
      `Couldn't create ${result.failureCount} sign-in accounts: ${result.errors.map((e) => e.error.message).join('; ')}`,
    )
  for (const user of users.filter((u) => u.provider === 'password')) {
    await auth.createUser({
      uid: user.uid,
      email: user.email,
      emailVerified: true,
      displayName: user.displayName,
      password: DEMO_PASSWORD,
    })
  }
  const userWriter = db.bulkWriter()
  users.forEach(
    (user) => void userWriter.set(db.doc(`users/${user.uid}`), { programId: DEMO_PROGRAM_ID }),
  )
  await userWriter.close()

  const password = users.filter((u) => u.provider === 'password')
  console.log(
    `\nSeeded "Example Robotics" into the emulators: ${docs.length} documents, ${users.length} people.`,
  )
  console.log(
    'Sign in with Google as any sample person, e.g. avery.k@example.edu (student), jordan.m@example.edu (team lead),',
  )
  console.log(`ms.patel@example.edu (mentor), coach.rivera@example.edu (program coach).`)
  password.forEach((user) =>
    console.log(
      `Email/password: ${user.email} / ${DEMO_PASSWORD} (${user.displayName}, outside volunteer mentor)`,
    ),
  )
  console.log('Browse the data at http://localhost:4000/firestore\n')
}

main().then(
  () => process.exit(0),
  (error: Error) => {
    console.error(`\n${error.message}\n`)
    process.exit(1)
  },
)
