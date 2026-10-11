# GitHub issues (optional)

A team can connect its code repository so that GitHub issues show up as tasks. It's off until you install the sync
described here.

The sync is part of the same small Google Apps Script as [email](email.md). Every 5 minutes it asks GitHub which
issues changed in each connected repo and updates the tasks. It works on Firebase's free Spark plan, and nothing is
added to the teams' repositories.

## What it does

- **A new open issue becomes a task** at the bottom of the team's Backlog, with the type "GitHub issue" and a link to
  the issue. The team chooses which subteam those tasks start in.
- **Closing the issue marks the task Done.** Reopening it moves the task back to To do.
- **A changed title or description follows GitHub**, unless someone edited it in the app; then the app's version stays.
- Each team turns the first two on or off in Team Settings → GitHub.

It only goes one way, from GitHub to Switchback. Marking a task Done in the app doesn't close the issue, and the sync
never changes anything on GitHub.

## What it copies, and what it doesn't

| Copied | Not copied |
|---|---|
| Title (the first 90 characters), issue number, link, open or closed | Who opened it, assignees, labels, milestones |
| The description, as plain text (up to 5,000 characters) | Comments, reactions, pull requests |

No GitHub usernames or profiles reach the database. People assign the task to teammates in the app as usual; that
matters because GitHub requires its users to be 13 or older, so younger students won't have accounts.

**Mind what's written in issue descriptions.** They're copied into the app, where the whole team can read them, so
the same care applies as to anything typed in the app: no personal details about students.

Issues that were already closed when a repo is first connected are left out, and so are pull requests.

## Install it

You need the Apps Script project from [email.md](email.md) (steps 1 to 5 there: build, create the project, paste the
code, point it at your Firebase project, add `PROJECT_ID` and `PROGRAM_ID`). You don't have to turn email on.

1. **Make a GitHub token** that can read issues. On GitHub: Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.
   - Resource owner: the organization that owns the teams' repos.
   - Repository access: the teams' repos (or all of the organization's).
   - Permissions: **Issues: Read-only**. (Metadata: Read-only is added for you.) Nothing else.
   - Public repos work without a token, but GitHub then limits how often anyone at Google's address can ask, and the
     sync will fail at busy times. Use a token.
2. **Add it to the script.** In Apps Script → Project Settings → Script properties, add `GITHUB_TOKEN` with the token.
   Treat it like a password; it lives only there.
3. **Connect a repo.** In the app, a team lead, mentor, or coach opens Team Settings → GitHub and enters
   `owner/repo` (or pastes the repo's github.com link).
4. **Turn it on.** In the Apps Script editor run `installGithub`. It syncs once straight away and logs what it did
   for each repo ("2 added, 0 updated", or why it couldn't), starts the 5-minute trigger, and tells the app the sync
   is on: Team Settings shows "Syncing" beside the repo.

After that, a new issue shows up in the Backlog within about 5 minutes.

## If something's wrong

Open Executions in Apps Script and look at the latest `syncIssues` run.

| It says | It means |
|---|---|
| `GitHub can't find owner/repo` | The repo name is wrong, or the token can't read it (private repo, or not included in the token's repository access). |
| `GitHub answered 401` | The token is wrong or has expired. Make a new one. |
| `GitHub answered 403` | Too many requests, or the organization hasn't approved the token. A token fixes the first; an organization owner approves the second. |
| Nothing, and no new tasks | "Add new issues to the Backlog" may be off for that team, or the issue was already closed. |

A task that someone deletes for good comes back if its issue changes again while it's still open. Archive it
instead, or close the issue.

## Turning it off

Run `uninstallGithub`. It removes the trigger and tells the app the sync is off. Tasks it already made stay.

A team can also disconnect its own repo in Team Settings; its existing tasks stay, and stop following their issues.

## Trying it without installing anything

With the local emulators running (`npm start`, `npm run seed:demo`), connect a repo in Team Settings, then:

```sh
npm run sync:github
```

It reads GitHub for real and writes only to the emulators. Set `GITHUB_TOKEN` in your shell for private repos.

## Changing the sync

The logic is in `scripts/github/sync.ts` (`planIssue` decides what one issue does to its task; unit tests in
`scripts/github/__tests__/`). `tests/rules/github.test.ts` runs the whole sync against the emulator with a stand-in
for GitHub. After a change, run `npm run build:email` and paste `dist-email/Code.gs` again.
