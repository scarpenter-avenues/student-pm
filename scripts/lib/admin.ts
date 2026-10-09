// Firebase Admin for the one-off scripts (setup, demo seed). Admin writes bypass the security rules, so these
// scripts are the only place that should create programs, seasons, and the first coach's invite.
import { readFileSync } from 'node:fs'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export const EMULATOR_PROJECT = 'demo-switchback'

export interface AdminOptions {
  /** Use the local emulators (must be running: `npm run emulators`). */
  emulator: boolean
  /** Firebase project id for real deployments. */
  project?: string
}

/** The default project from .firebaserc (set with `firebase use --add`). */
function defaultProject(): string | undefined {
  try {
    return JSON.parse(readFileSync('.firebaserc', 'utf8')).projects?.default
  } catch {
    return undefined
  }
}

export function connectAdmin({ emulator, project }: AdminOptions) {
  const projectId = emulator ? EMULATOR_PROJECT : (project ?? defaultProject())
  if (emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
    process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
    // The emulators need no Google Cloud credentials; skip the metadata-server lookup (and its warning).
    process.env.METADATA_SERVER_DETECTION ??= 'none'
  } else if (!projectId || projectId.startsWith('demo-')) {
    throw new Error(
      'Which Firebase project? Pass --project <id>, or run `firebase use --add` first. (Use --emulator to try it locally.)',
    )
  }
  // Real projects use Application Default Credentials: `gcloud auth application-default login`, or
  // GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key (never commit it).
  const app = getApps()[0] ?? initializeApp({ projectId })
  return { projectId: projectId!, db: getFirestore(app), auth: getAuth(app) }
}

/** Fails fast with a clear message if the emulator isn't running. */
export async function checkEmulator(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
  try {
    await fetch(`http://${host}/`)
  } catch {
    throw new Error(
      `The Firestore emulator isn't running at ${host}. Start it with \`npm run emulators\` (or \`npm start\`) in another terminal.`,
    )
  }
}

export function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--') && !arg.includes('=')))
  const value = (name: string) => {
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`))
    if (inline) return inline.split('=').slice(1).join('=')
    const index = argv.indexOf(`--${name}`)
    return index >= 0 && argv[index + 1] && !argv[index + 1]!.startsWith('--')
      ? argv[index + 1]
      : undefined
  }
  return { flags, value }
}
