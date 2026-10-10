# Email (optional)

Switchback can email announcements, huddles, and quick notes. It's off until you install the sender described here.

The sender is a small Google Apps Script that you run under a Google account in your own organization. Every
minute it checks for new posts and sends them through that account's Gmail. Nothing goes through an outside mail
company, and it works on Firebase's free Spark plan.

## What gets sent, and to whom

| Post | Emailed to |
|---|---|
| An announcement to one or more teams (with "Also send by email" ticked) | Those teams' students, leads, and mentors, plus every program coach |
| An announcement to all teams | Everyone in the program |
| A huddle or quick note | Every coach and mentor (never students) |

- The author isn't emailed their own post, and nobody gets the same post twice.
- **Students are left out unless you turn them on** (`INCLUDE_STUDENTS`, below). Until then, announcements are emailed
  to mentors and coaches only. Decide this with your organization: emailing students is a communication-policy choice.
- Recipients are blind-copied, so nobody sees anyone else's address.
- Emails are plain text with a link back to the app. The formatted text people write in the app is never sent as HTML.
- Editing a post later doesn't send it again. A post deleted before it's sent is skipped.
- Addresses come from Firebase Authentication (the email each person signs in with). They aren't copied anywhere.
- Someone who has been added but hasn't signed in yet isn't emailed: they have no sign-in address until their first
  sign-in.

## How it works

Posting with email writes a small record to `programs/{id}/outbox`: which post, who posted it, and `state: "pending"`.
It holds no addresses and no text. The security rules let someone add a record only for a post they are creating in
that same write, and never change one afterward.

The script, which runs as your project's owner, reads the pending records, works out the recipients, sends, and marks
each record `sent`, `skipped`, or `failed` (with how many people it went to, or why not). Program coaches can read the
outbox; nobody else can.

## Install it

You need: the Google account that will send the mail (it must be able to open your Firebase project), and Node.js to
build the script.

1. **Build the script.** In this repo run `npm run build:email`. It writes `dist-email/Code.gs` and
   `dist-email/appsscript.json`.
2. **Create the Apps Script project.** Go to [script.new](https://script.new) signed in as the sending account, and name
   it (e.g. "Switchback email").
3. **Paste the code.** Replace the contents of `Code.gs` with `dist-email/Code.gs`. Then open Project Settings, tick
   "Show appsscript.json manifest file in editor", and replace that file's contents with `dist-email/appsscript.json`.
4. **Point it at your Firebase project.** In Project Settings → Google Cloud Platform (GCP) Project, choose Change
   project and enter your Firebase project's **project number** (Firebase console → Project settings). Apps Script may
   first ask you to set up the OAuth consent screen in that project; choose "Internal" if you're in Google Workspace.
5. **Add the settings.** In Project Settings → Script properties, add:

   | Property | Value |
   |---|---|
   | `PROJECT_ID` | Your Firebase project ID |
   | `PROGRAM_ID` | `program.id` from your `program.config.json` |
   | `APP_URL` | Where your app lives, e.g. `https://your-project.web.app` |
   | `TEST_REDIRECT` | *(while testing)* An address of yours other than the sending account: every email goes there instead of to real people |
   | `INCLUDE_STUDENTS` | `true` to email students too; leave it out to email mentors and coaches only |

6. **Check mail works.** In the editor, pick the function `sendTestEmail` and click Run. Approve the permissions it
   asks for. One email goes to `TEST_REDIRECT` if you set it, otherwise to you. Use an address other than the sending
   account for this: Gmail often doesn't show mail you send to yourself in the inbox (look in Sent or All Mail).
7. **Turn it on.** Run `install`. It starts a trigger that runs `sendPending` every minute, and tells the app that
   email is on: "Also send by email" appears on new announcements, and huddles say they'll be emailed.

## Test before real people get mail

1. Leave `TEST_REDIRECT` set to an address of yours other than the sending account.
2. Post an announcement, a huddle, and a quick note in the app.
3. Within a minute or two (or run `sendPending` yourself) you get each one, with `[TEST]` in the subject and a first line
   saying who it would have gone to.
4. When you're happy, delete `TEST_REDIRECT`. The next post goes to real people.

To see what happened to a post, open Executions in Apps Script (each run logs what it sent), or look at the outbox in
the Firebase console.

## Turning it off

Run `uninstall`. It removes the trigger and tells the app that email is off. Posts made after that aren't queued.

## Limits

- Gmail limits how many recipients a script can mail each day (about 1,500 for Google Workspace accounts, 100 for
  consumer Gmail). If a post needs more than is left for the day, it waits and is sent the next day rather than
  reaching only some people.
- Up to a minute or two passes between posting and sending. Each check that finds nothing costs one Firestore read
  (about 1,440 a day, well inside the free plan's 50,000).
- Mail comes from the account that installed the script, shown under your program's name. Replies go to that account.

## Changing the sender

The sources are in `scripts/email/` (TypeScript, bundled by `npm run build:email`). `messages.ts` decides who gets
what and what it says; its unit tests are in `scripts/email/__tests__/`, and `tests/rules/email.test.ts` runs the whole
sender against the emulator with a fake mailbox. After a change, rebuild and paste `Code.gs` again.
