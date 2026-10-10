// npm run setup -- [--emulator] [--project <id>] [--config <path>] [--dry-run]
//
// Creates (or updates) your program in Firestore from program.config.json: the program and its sign-in settings,
// the season, default subteams, starting teams with their sprint calendars, and the first coach's invite.
// Safe to re-run: existing teams are left as they are, and the first coach is invited only if there's no coach yet.
import { FieldValue } from 'firebase-admin/firestore'
import { buildSprints } from '../src/model/sprints'
import { checkCredentials, checkEmulator, connectAdmin, parseArgs } from './lib/admin'
import {
  loadConfig,
  programAuthFrom,
  signInMethodFor,
  slugify,
  type ProgramConfig,
} from './lib/config'

async function main() {
  const { flags, value } = parseArgs(process.argv.slice(2))
  const emulator = flags.has('--emulator')
  const dryRun = flags.has('--dry-run')
  const config: ProgramConfig = loadConfig(value('config') ?? 'program.config.json')
  const { db, projectId } = connectAdmin({ emulator, project: value('project') })
  if (emulator) await checkEmulator()
  else await checkCredentials()

  const programRef = db.doc(`programs/${config.program.id}`)
  const existing = await programRef.get()
  const subteamDefaults = config.subteamDefaults.map((subteam) => ({
    id: slugify(subteam.name),
    ...subteam,
  }))
  const auth = programAuthFrom(config)
  const log: string[] = []
  const batch = db.batch()

  // The program: name, sign-in, and subteam defaults always follow the config. The current season is set only when
  // the program is new; after that, seasons change through "Start a new season" in the app.
  batch.set(
    programRef,
    {
      name: config.program.name,
      auth,
      subteamDefaults,
      ...(existing.exists ? {} : { currentSeasonId: config.season.id }),
    },
    { merge: true },
  )
  // The sign-in page reads this before anyone has signed in, so it holds only the name and sign-in methods.
  batch.set(programRef.collection('public').doc('signIn'), { name: config.program.name, auth })
  log.push(
    `${existing.exists ? 'Updated' : 'Created'} program "${config.program.name}" (${config.program.id})`,
  )

  const season = config.season
  batch.set(
    programRef.collection('seasons').doc(season.id),
    { name: season.name, start: season.start, end: season.end },
    { merge: true },
  )
  log.push(`Season ${season.name}: ${season.start} – ${season.end}`)

  for (const team of config.teams ?? []) {
    const teamId = slugify(team.name)
    const teamRef = programRef.collection('teams').doc(teamId)
    if ((await teamRef.get()).exists) {
      log.push(`Team "${team.name}" already exists; left as is`)
      continue
    }
    const sprintDays = team.sprintDays ?? 14
    batch.set(teamRef, {
      name: team.name,
      number: team.number ?? '',
      color: team.color ?? 'green',
      sprintDays,
      seasonIds: [season.id],
      subteams: subteamDefaults,
      github: { repo: null, importIssues: true, closeOnDone: true },
      createdAt: FieldValue.serverTimestamp(),
    })
    const sprints = buildSprints(season.start, season.end, sprintDays)
    sprints.forEach((sprint) => {
      batch.set(teamRef.collection('sprints').doc(`${season.id}-s${sprint.index + 1}`), {
        seasonId: season.id,
        ...sprint,
        objectives: [],
      })
    })
    log.push(`Created team "${team.name}" with ${sprints.length} ${sprintDays}-day sprints`)
  }

  // The first coach: an invite they claim the first time they sign in. Skipped once the program has a coach.
  const hasCoach = !(
    await programRef.collection('members').where('role', '==', 'coach').limit(1).get()
  ).empty
  const email = config.firstCoach.email.toLowerCase()
  if (hasCoach) log.push('The program already has a coach; no invite needed')
  else {
    batch.set(programRef.collection('invites').doc(email), {
      email,
      displayName: config.firstCoach.displayName,
      role: 'coach',
      teamIds: [],
      subteams: {},
      invitedBy: 'setup',
      invitedAt: FieldValue.serverTimestamp(),
    })
    log.push(`Invited ${config.firstCoach.displayName} <${email}> as the first program coach`)
  }

  console.log(
    `\nSwitchback setup → ${emulator ? 'local emulators' : `Firebase project ${projectId}`}${dryRun ? ' (dry run: nothing written)' : ''}\n`,
  )
  log.forEach((line) => console.log(`  • ${line}`))
  if (dryRun) return
  await batch.commit()
  const method =
    signInMethodFor(config, email, 'coach') === 'google' ? 'Google' : 'email and password'
  console.log(
    hasCoach
      ? '\nDone.\n'
      : `\nDone. ${config.firstCoach.displayName} signs in with ${method} as ${email}, then adds everyone else in Coaches' Dashboard → Settings.\n`,
  )
}

main().then(
  () => process.exit(0),
  (error: Error) => {
    console.error(`\n${error.message}\n`)
    process.exit(1)
  },
)
