// The Apps Script side of the email sender: settings from Script properties, network through UrlFetchApp, mail
// through MailApp (the Gmail account of whoever installs it), and a time trigger. `npm run build:email` bundles
// this into dist-email/Code.gs; see docs/email.md for installing it.
import { processOutbox, type Io } from './outbox'
import { createStore, GOOGLE_HOSTS, type Request } from './rest'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const UrlFetchApp: any
declare const MailApp: any
declare const ScriptApp: any
declare const PropertiesService: any
declare const LockService: any
declare const Session: any
/* eslint-enable @typescript-eslint/no-explicit-any */

const TRIGGER = 'sendPending'

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

const store = () => {
  const { projectId, programId } = settings()
  return createStore(request, GOOGLE_HOSTS, projectId, programId)
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

function uninstallTriggers() {
  for (const trigger of ScriptApp.getProjectTriggers())
    if (trigger.getHandlerFunction() === TRIGGER) ScriptApp.deleteTrigger(trigger)
}

/** Stops sending and tells the app that email is off. */
export function uninstall() {
  uninstallTriggers()
  store().setEmailOn(false)
  console.log('Email is off.')
}

/** Sends one sample email to you, to check that mail and the settings work. */
export function sendTestEmail() {
  const current = settings()
  const program = store().get('')
  io.sendMail({
    bcc: [Session.getEffectiveUser().getEmail()],
    fromName: String(program?.data.name ?? 'Switchback'),
    subject: `${String(program?.data.name ?? 'Switchback')}: email is working`,
    text: `This is a test from the Switchback email sender.\n\nOpen the app: ${current.appUrl}`,
    html: `<p>This is a test from the Switchback email sender.</p><p><a href="${current.appUrl}">Open the app</a></p>`,
  })
  console.log(`Sent. ${io.quota()} recipients left today.`)
}
