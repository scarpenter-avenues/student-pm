# Security and privacy

Switchback is used by students, including some under 13, so a security or privacy problem here matters more than in
most small projects. Thank you for taking the time to report one.

## Reporting a problem in the code

**Please don't open a public issue.** Use the repository's **Security** tab → **Report a vulnerability**. That sends
a private report that only the maintainers can read.

It helps to include:

- What you were able to do that you shouldn't have been able to (for example, "signed in as a student, I could read
  another team's tasks").
- The steps to reproduce it, ideally against the local emulators with the sample data (`npm start`, then
  `npm run seed:demo`). No real program is needed, and none should be used.
- The commit or version you tested.

Please don't include real students' names, emails, or anything they wrote. Describe what was exposed instead.

This is a volunteer project, so replies are best-effort, but reports about student data come first. Once a fix is
out, we're glad to credit you if you'd like.

## What counts

Anything that lets someone see or change what they shouldn't. In particular:

- A hole in [`firestore.rules`](firestore.rules): a student reading another team's work or another student's goal, a
  member changing their own role or team, anyone outside a program reading its data.
- Stored text (announcements, notes, comments, GitHub issue descriptions) running as code in someone's browser.
- The app sending data to a third party. It is meant to load nothing from, and send nothing to, anyone but the
  deployment's own Firebase project.
- The email or GitHub jobs sending something to the wrong people, or copying more than their docs say they do.
- A secret or a real person's details committed to this repository.

Ordinary bugs (a button that doesn't work, a layout problem) belong in a normal issue.

## Problems with a particular school's or club's copy

Each organization runs its own copy of Switchback in its own Firebase project. The maintainers of this repository
can't see or reach that data.

If you think data in a particular deployment was exposed, or you want something removed from it, contact the
organization that runs it. If the cause looks like a flaw in the code, please report that here as well, so every
deployment gets the fix.

## If you run a deployment

- Deploy the security rules from this repository unchanged, or test any change with `npm run test:rules`.
- Keep `program.config.json`, `.env.local`, and service-account keys out of version control (they are git-ignored
  here).
- The email and GitHub jobs keep their secrets in Apps Script properties. Treat a GitHub token like a password, and
  give it read-only access to issues and nothing else.
- Watch this repository's releases and security advisories, and redeploy when the rules change.
