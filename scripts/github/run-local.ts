// Tries the GitHub sync on your own machine: reads GitHub for real, writes only to the local emulators
// (`npm start`, then `npm run seed:demo`). Connect a repo first in Team Settings → GitHub.
//
//   npm run sync:github            every team's open issues (each run starts fresh, like a first run)
//   GITHUB_TOKEN=… npm run sync:github   for private repos, or if GitHub says you've asked too often
//
// A real deployment runs the same code from Apps Script instead; see docs/github.md.
import { execFileSync } from 'node:child_process'
import { createStore, type Request } from '../email/rest'
import { syncGithub } from './sync'

const PROJECT = 'demo-switchback'
const PROGRAM = process.env.VITE_PROGRAM_ID ?? 'example-robotics'
const FIRESTORE = `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}`

/** Synchronous HTTP (the sync is written for Apps Script, where network calls are synchronous). */
function curl(method: string, url: string, headers: string[], body?: unknown) {
  const out = execFileSync(
    'curl',
    [
      '-s',
      '-g',
      '-m',
      '20',
      '-X',
      method,
      ...headers.flatMap((header) => ['-H', header]),
      '-w',
      '\n%{http_code}',
      ...(body === undefined ? [] : ['-d', JSON.stringify(body)]),
      url,
    ],
    { encoding: 'utf8' },
  )
  const at = out.lastIndexOf('\n')
  let json: unknown = null
  try {
    json = JSON.parse(out.slice(0, at) || 'null')
  } catch {
    json = null
  }
  return { status: Number(out.slice(at + 1)), json }
}

// "Bearer owner" is the emulator's admin; it means nothing to a real project.
const request: Request = (method, url, body) =>
  curl(method, url, ['Authorization: Bearer owner', 'Content-Type: application/json'], body)

try {
  await fetch(`${FIRESTORE}/`)
} catch {
  console.error(
    `\nThe Firestore emulator isn't running at ${FIRESTORE}. Start it with \`npm start\`.\n`,
  )
  process.exit(1)
}

const cursors: Record<string, string> = {}
const token = process.env.GITHUB_TOKEN
const results = syncGithub(
  createStore(request, { firestore: FIRESTORE, auth: '' }, PROJECT, PROGRAM),
  {
    github: (path) =>
      curl('GET', `https://api.github.com${path}`, [
        'Accept: application/vnd.github+json',
        'X-GitHub-Api-Version: 2022-11-28',
        'User-Agent: switchback-sync',
        ...(token ? [`Authorization: Bearer ${token}`] : []),
      ]),
    cursor: (key) => cursors[key] ?? null,
    setCursor: (key, iso) => (cursors[key] = iso),
    now: () => new Date(),
    log: () => {},
  },
)
if (!results.length) console.log('\nNo team has a repo connected (Team Settings → GitHub).\n')
for (const result of results)
  console.log(
    `${result.repo.padEnd(44)} ${result.note ?? `${result.created} added, ${result.updated} updated`}`,
  )
