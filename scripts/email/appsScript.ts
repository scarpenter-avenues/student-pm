// The Apps Script side of the two background jobs a program can install: the email sender (docs/email.md) and the
// GitHub sync (docs/github.md). Settings come from Script properties, network goes through UrlFetchApp, mail
// through MailApp (the Gmail account of whoever installs it), and each job has its own time trigger. `npm run
// build:email` bundles this into dist-email/Code.gs. Install either job or both.
import { processOutbox, type Io } from './outbox'
import { createStore, GOOGLE_HOSTS, type Request } from './rest'
import { syncGithub, type GithubIo } from '../github/sync'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const UrlFetchApp: any
declare const MailApp: any
declare const ScriptApp: any
declare const PropertiesService: any
declare const LockService: any
declare const Session: any
/* eslint-enable @typescript-eslint/no-explicit-any */

const TRIGGER = 'sendPending'

// The email sender's settings, read from Script properties each run (so a change takes effect without
// redeploying).
function settings() {
  const properties = PropertiesService.getScriptProperties()
  const need = (key: string): string => {
    const value = (properties.getProperty(key) ?? '').trim()
    if (!value)
      throw new Error(`Set the script property ${key} (Project Settings → Script properties).`)
    return value
  }
  return {
    projectId: need('PROJECT_ID'),
    programId: need('PROGRAM_ID'),
    appUrl: need('APP_URL').replace(/\/+$/, ''),
    // Off unless it says "true": until the organization decides, email goes to mentors and coaches only.
    includeStudents: (properties.getProperty('INCLUDE_STUDENTS') ?? '').trim() === 'true',
    redirectTo: (properties.getProperty('TEST_REDIRECT') ?? '').trim() || null,
  }
}

// How the script talks to Google's APIs: as whoever installed it, using their sign-in. That is what lets it
// read the database without going through the app's security rules.
const request: Request = (method, url, body) => {
  const response = UrlFetchApp.fetch(url, {
    method: method.toLowerCase(),
    contentType: 'application/json',
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true,
  })
  const text: string = response.getContentText()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text.slice(0, 300)
  }
  return { status: response.getResponseCode(), json }
}

const io: Io = {
  sendMail: ({ bcc, subject, text, html, fromName }) =>
    MailApp.sendEmail({
      // Gmail needs a "to"; everyone real is blind-copied.
      to: Session.getEffectiveUser().getEmail(),
      bcc: bcc.join(','),
      subject,
      body: text,
      htmlBody: html,
      name: fromName,
    }),
  quota: () => MailApp.getRemainingDailyQuota(),
  log: (message) => console.log(message),
}

/** The database, which needs only the project and program (email's other settings aren't required for it). */
const store = () => {
  const properties = PropertiesService.getScriptProperties()
  const need = (key: string): string => {
    const value = (properties.getProperty(key) ?? '').trim()
    if (!value)
      throw new Error(`Set the script property ${key} (Project Settings → Script properties).`)
    return value
  }
  return createStore(request, GOOGLE_HOSTS, need('PROJECT_ID'), need('PROGRAM_ID'))
}

/** Runs every minute (see install): sends whatever is waiting. */
export function sendPending() {
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(1000)) return
  try {
    const results = processOutbox(store(), io, settings())
    if (results.length) console.log(JSON.stringify(results))
  } finally {
    lock.releaseLock()
  }
}

/** Run once: checks the settings, starts the every-minute trigger, and tells the app that email is on. */
export function install() {
  const current = settings()
  const program = store().get('')
  if (!program)
    throw new Error(`Can't find the program "${current.programId}" in ${current.projectId}.`)
  uninstallTriggers()
  ScriptApp.newTrigger(TRIGGER).timeBased().everyMinutes(1).create()
  store().setEmailOn(true)
  console.log(
    `Email is on for ${String(program.data.name)}. ${
      current.redirectTo
        ? `TEST mode: everything goes to ${current.redirectTo}.`
        : current.includeStudents
          ? 'Announcements go to students, mentors, and coaches.'
          : 'Announcements go to mentors and coaches only (INCLUDE_STUDENTS is not "true").'
    }`,
  )
}

// Removes a job's time trigger (so installing twice never leaves two).
function uninstallTriggers(handler = TRIGGER) {
  for (const trigger of ScriptApp.getProjectTriggers())
    if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger)
}

/** Stops sending and tells the app that email is off. */
export function uninstall() {
  uninstallTriggers()
  store().setEmailOn(false)
  console.log('Email is off.')
}

/**
 * Sends one sample email to check that mail and the settings work: to TEST_REDIRECT if it's set, otherwise to you.
 * (Gmail may not show mail you send to yourself in the inbox, so a different address is the better test.)
 */
export function sendTestEmail() {
  const current = settings()
  const program = store().get('')
  const to = current.redirectTo ?? Session.getEffectiveUser().getEmail()
  io.sendMail({
    bcc: [to],
    fromName: String(program?.data.name ?? 'Switchback'),
    subject: `${String(program?.data.name ?? 'Switchback')}: email is working`,
    text: `This is a test from the Switchback email sender.\n\nOpen the app: ${current.appUrl}`,
    html: `<p>This is a test from the Switchback email sender.</p><p><a href="${current.appUrl}">Open the app</a></p>`,
  })
  console.log(`Sent to ${to}. ${io.quota()} recipients left today.`)
}

// ---------- GitHub sync ----------
const GITHUB_TRIGGER = 'syncIssues'

// What the sync needs from outside: GitHub's API, somewhere to remember how far it got, the time, and a log.
function githubIo(): GithubIo {
  const properties = PropertiesService.getScriptProperties()
  // Optional for public repos, but without it GitHub's shared limit is quickly used up.
  const token = (properties.getProperty('GITHUB_TOKEN') ?? '').trim()
  return {
    // One GET to the GitHub API, with the token if there is one. Errors come back as a status, not an
    // exception, so one bad repo can be reported without stopping the others.
    github(path) {
      const response = UrlFetchApp.fetch(`https://api.github.com${path}`, {
        method: 'get',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        muteHttpExceptions: true,
      })
      let json: unknown = null
      try {
        json = JSON.parse(response.getContentText() || 'null')
      } catch {
        json = null
      }
      return { status: response.getResponseCode(), json }
    },
    cursor: (key) => properties.getProperty(`GITHUB_SINCE ${key}`),
    setCursor: (key, iso) => properties.setProperty(`GITHUB_SINCE ${key}`, iso),
    now: () => new Date(),
    log: (message) => console.log(message),
  }
}

/** Runs every 5 minutes (see installGithub): brings each connected team's issues up to date. */
export function syncIssues() {
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(1000)) return
  try {
    const results = syncGithub(store(), githubIo())
    const worth = results.filter((result) => result.created || result.updated || result.note)
    if (worth.length) console.log(JSON.stringify(worth))
    return results
  } finally {
    lock.releaseLock()
  }
}

/** Run once: syncs now (so you see it work), starts the 5-minute trigger, and tells the app the sync is on. */
export function installGithub() {
  const results = syncIssues() ?? []
  uninstallTriggers(GITHUB_TRIGGER)
  ScriptApp.newTrigger(GITHUB_TRIGGER).timeBased().everyMinutes(5).create()
  store().setProgramSwitch('githubSync', true)
  console.log(
    results.length
      ? `GitHub sync is on. ${results.map((r) => `${r.repo}: ${r.note ?? `${r.created} added, ${r.updated} updated`}`).join(' · ')}`
      : 'GitHub sync is on. No team has connected a repo yet (Team Settings → GitHub).',
  )
}

/** Stops syncing and tells the app the sync is off. Tasks already made stay. */
export function uninstallGithub() {
  uninstallTriggers(GITHUB_TRIGGER)
  store().setProgramSwitch('githubSync', false)
  console.log('GitHub sync is off.')
}
