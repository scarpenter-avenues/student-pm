# Firestore data model

Design for the production app (Vue 3 + Vite + TypeScript, Firebase Auth + Firestore + Hosting on the Spark plan).
It covers every feature in the mock-up (`mockup/index.html`, described in `CLAUDE.md`). The security rules are in
`/firestore.rules` and are tested against the Firestore emulator by `tests/rules/` (`npm run test:rules`), one or more
tests per row of the access table below.

## Principles

1. **Rules enforce privacy, not the UI.** Firestore rules allow or deny whole documents, never single fields. So
   anything with mixed visibility is split into separate documents (goals are the main case).
2. **Minimal personal data** (COPPA). We store a user ID (UID), a display name (first name and last initial), a role,
   and team membership. The email lives only in Firebase Auth, in pending invites, and in a coach-only contact doc. Member
   lists never show it.
3. **Everything belongs to a program** (a school's or club's set of teams). Each program turns on its sign-in methods in
   `program.config.json` (see `docs/configuration.md`): Google restricted to its Workspace domain(s), email/password
   (optionally only for some roles, e.g. outside mentors), or both.
4. **IDs, not names.** Tasks, comments, and goal events store UIDs and team IDs. The app loads each team's roster once and
   looks names up, so renaming someone or removing a former member never leaves stale copies.
5. **Small, team-scoped reads.** Every query is limited to one team (or, for program coaches, one team at a time), so
   ~100 daily users fit the free tier.
6. **Archive, don't delete.** Tasks get an `archived` field; only adults can hard-delete, and only archived tasks.

## Collection tree

```
users/{uid}                                   which program a signed-in person belongs to
programs/{programId}                          program settings
  public/signIn                               name + sign-in methods, readable before sign-in
  members/{uid}                               people who have signed in (roster)
    private/contact                           email, coach-only
  invites/{emailLower}                        people added but not signed in yet
  seasons/{seasonId}                          "2026–27"
  teams/{teamId}                              team profile, subteams, GitHub settings
    sprints/{sprintId}                        dates + objectives
    tasks/{taskId}                            tasks with embedded subtasks
      comments/{commentId}                    task and subtask comments
    events/{eventId}                          team-only events (qualifiers, …)
    pages/home                                Team Home notes
  events/{eventId}                            program-wide events
  announcements/{announcementId}              team or program-wide posts
  huddles/{huddleId}                          adults-only daily status + quick notes
  goalSummaries/{goalId}                      statement + status (teammates can read)
  goals/{goalId}                              the private part of a goal
    events/{eventId}                          created, check-ins, feedback, replies, pauses…
  userState/{uid}                             per-person read markers and UI state
```

## Types

Dates without times (`start`, `due`, sprint dates, event dates, a goal's "by" date) are stored as `"YYYY-MM-DD"` strings.
That matches how they're picked and avoids time-zone shifts. Moments (`createdAt`, `archivedAt`, `postedAt`) are Firestore
`Timestamp`s.

### `users/{uid}`
```ts
interface UserDoc { programId: string }   // written once, at first sign-in (invite claim)
```

### `programs/{programId}`
```ts
interface Program {
  name: string;                                   // "Example Robotics"
  auth: {                                         // seeded from program.config.json; at least one method
    google?: { domains: string[] };               // e.g. ["example.edu"]
    password?: { roles: Role[] };                 // who may use email/password, e.g. ["mentor", "coach"]
  };
  subteamDefaults: Subteam[];                     // copied into new teams
  currentSeasonId: string;
}
interface Subteam { id: string; name: string; color: SubteamColor; description: string }
type SubteamColor = "red" | "green" | "yellow" | "blue" | "purple" | "teal" | "pink" | "gray";
```

### `members/{uid}`: the roster
```ts
type Role = "student" | "lead" | "mentor" | "coach";
interface Member {
  displayName: string;                            // "Avery K." (first name + last initial)
  role: Role;
  teamIds: string[];                              // students/leads: 0 or 1; mentors: 1+; coaches: [] (all teams)
  subteams: Record<string, string[]>;             // teamId → subteam ids, e.g. { cb418: ["mech", "sw"] }
  joinedAt: Timestamp;
}
// members/{uid}/private/contact  (coaches only)
interface Contact { email: string }
```
- Program coaches have `teamIds: []`; the rules treat them as members of every team.
- A mentor on several teams is one member doc with several `teamIds` (replaces the mock-up's shared roster objects).
- "No team" is `teamIds: []` with a non-coach role.

### `public/signIn`: what the sign-in page reads
```ts
interface PublicSignIn { name: string; auth: Program["auth"] }   // anyone can read; program coaches write
```
Written by `npm run setup` (and kept in step with `program.auth`). It holds nothing personal, so the sign-in page can
show the program's name and the right sign-in buttons before anyone has signed in.

### `invites/{emailLower}`: added but not signed in yet
```ts
interface Invite {
  email: string;                                  // lowercased, same as the doc id
  displayName: string; role: Role; teamIds: string[]; subteams: Record<string, string[]>;
  invitedBy: string; invitedAt: Timestamp;
}
```
**Which sign-in method:** an email on one of the program's Google domains must sign in with Google; any other email uses
email/password (verified), and only if the program allows password sign-in for that person's role. The app checks this
when adding someone; the rules check it again when the invite is claimed.

**First sign-in:** the app reads `invites/{email}` for the signed-in email (the rules allow it only for your own,
verified email; a collection-group query on `invites` also works if a deployment ever serves several programs). It then
writes one batch: create `members/{uid}` (the rules check it matches the invite), create `users/{uid}` (unless it exists
from an earlier membership), and delete the invite. No server code is needed. The display name comes from the invite,
never from the Google profile. Add person, Add member, and CSV import all write invites; the People list shows
invites as "hasn't signed in yet".

### `seasons/{seasonId}`
```ts
interface Season { name: string; start: string; end: string }   // "2026–27"
```
`program.currentSeasonId` says which one is current. Goal history is grouped by season.

**Starting a new season** (Program settings → Seasons → "Start a new season…", program coaches): the coach names the
season and sets its dates, picks which teams carry over, chooses for each person whether they stay, move to "No team",
or leave the program, and decides what happens to unfinished tasks (move to Backlog, or archive). Starting it writes:
- the new `seasons/{id}` doc, `program.currentSeasonId`, and an earlier `end` on the old season if they overlap;
- `seasonIds` on each carried-over team (teams not carried over simply don't get it);
- new `sprints` for each carried-over team, Sprint 1 starting on the season's first day, at the team's `sprintDays`;
- member updates: `teamIds`/`subteams` for people moving to No team; deletes (plus `assigneeIds` clean-up) for people
  leaving the program;
- unfinished tasks: `sprintId: null` (Backlog) or `archived`. Finished tasks stay on last season's sprints.
Firestore batches hold at most 500 writes, so the app commits this in several batches and shows progress. Goals aren't
touched: they follow the students.

### `teams/{teamId}`
```ts
interface Team {
  name: string; number: string;                   // FTC number, unique in the program
  seasonIds: string[];                            // seasons the team played; in the current season = active
  color: string;                                  // preset key ("green") or custom "#rrggbb"
  sprintDays: 7 | 10 | 14 | 21;
  subteams: Subteam[];                            // the team's own copy, editable in team Settings
  github: { repo: string | null; importIssues: boolean; closeOnDone: boolean };
  createdAt: Timestamp;
}
```
The roster isn't stored on the team. It's the query `members where teamIds array-contains teamId`, plus coaches.
Teams not in the current season are inactive: kept with their history, hidden from every view except Program settings →
Teams → "Not in this season", where a coach can bring them back.

### `teams/{teamId}/sprints/{sprintId}`
```ts
interface Sprint {
  seasonId: string; name: string;                 // "Sprint 3"
  index: number;                                  // order within the season
  start: string; end: string;
  objectives: { id: string; text: string; subteamIds: string[]; met: boolean }[];   // text ≤ 80 chars
}
```
Moving a sprint's end shifts every later sprint: one batched write across those docs.

### `teams/{teamId}/tasks/{taskId}`
```ts
type Status = "To do" | "In progress" | "Done";
type TaskType = "Task" | "Learning" | "Idea" | "GitHub issue";
interface Task {
  title: string;                                  // ≤ 90 chars
  type: TaskType;                                 // "GitHub issue" is set only by the integration, then locked
  status: Status;
  sprintId: string | null;                        // null = Backlog
  rank: string;                                   // fractional index; order is priority (no priority field)
  subteamIds: string[];                           // several allowed; first one is the Timeline group
  assigneeIds: string[];                          // UIDs; "My Tasks" = array-contains me
  start: string | null; due: string | null;
  descriptionHtml: string;                        // Tiptap output
  subtasks: Subtask[];                            // array order = step order
  goalId: string | null;                          // Learning tasks created from a goal (setup or check-in)
  github: { repo: string; number: number; url: string; state: "open" | "closed" } | null;
  archived: { by: string; at: Timestamp; from: string } | null;   // from: "Sprint 3", "Backlog", …
  createdBy: string; createdAt: Timestamp; updatedAt: Timestamp;
}
interface Subtask {
  id: string; title: string; status: Status;
  assigneeIds: string[]; start: string | null; due: string | null;
  subteamIds: string[]; type: TaskType; descriptionHtml: string;
  archived: { by: string; at: Timestamp } | null;
}
```
- **Subtasks are embedded**, matching the decision that they aren't full tasks. One read gets a card with all its steps.
  Reordering is a single write. "Make it a task" copies one out into a new task doc (and moves its comments).
- **Order:** `rank` uses fractional indexing (e.g. the `fractional-indexing` package), so moving a task writes only that
  task. Board and List both sort by `rank` within the sprint; Planning sorts each section by `rank`.
- **Archive** sets `archived`; Undo and Restore clear it. Every view queries `where("archived", "==", null)`.

### `tasks/{taskId}/comments/{commentId}`
```ts
interface Comment { authorId: string; text: string; subtaskId: string | null; createdAt: Timestamp }
```

### Events
```ts
// programs/{p}/events/{id}  (program-wide; coaches edit)   teams/{t}/events/{id}  (team; anyone on the team edits)
interface CalendarEvent {
  title: string; date: string; time: string; location: string;
  type: "Competition" | "Work session" | "Other";
  conditional: boolean;                           // "If qualified": skipped by the countdown
}
```

### `teams/{teamId}/pages/home`
```ts
interface Page { html: string; updatedBy: string; updatedAt: Timestamp }
```

### `announcements/{id}`
```ts
interface Announcement {
  title: string; bodyHtml: string; body: string;  // body = plain text for email and previews
  audience: string[];                             // ["all"] or team ids
  authorId: string; postedAt: Timestamp; emailed: boolean;
}
```
Read markers live in `userState`, not on the announcement, so marking something read never rewrites a shared doc.

### `huddles/{id}`: adults only
```ts
interface Huddle {
  kind: "huddle" | "note";
  date: string; authorId: string; postedAt: Timestamp;
  statusHtml?: string; status?: string;           // "Where things stand"
  plan?: { time: string; text: string; audience: string[] }[];   // ["all"], ["adults"], or team ids
  notesHtml?: string; notes?: string;             // "Heads-ups and needs"
  textHtml?: string; text?: string;               // quick notes
  readBy: string[];                               // adult UIDs; "seen by N of M"
}
```

### Goals: two documents per goal
Teammates may see a goal's **statement and status** and nothing else. Rules work per document, so:

```ts
// goalSummaries/{goalId}: readable by everyone on the student's team
interface GoalSummary {
  studentId: string; teamId: string;              // the student's CURRENT team (updated if they move)
  seasonId: string;
  statement: string;                              // "Design parts in Onshape"
  status: GoalStatus; state: GoalState;           // paused goals are hidden from teammates by the app
}
// goals/{goalId}: the student, coaches, and mentors of the student's current team
interface Goal {
  studentId: string; teamId: string;              // current team (same as the summary)
  createdTeamId: string; seasonId: string;
  wish: string; evidence: string; obstacle: string; plan: string;
  by: { label: string; date: string | null };     // "Qualifier 2", "End of Sprint 5"
  status: GoalStatus; state: GoalState;
  createdAt: Timestamp; finishedAt: Timestamp | null; pausedAt: Timestamp | null;
  reflection: { helped: string; different: string; next: string } | null;
  lastCheckinAt: string | null;
  unreadFeedback: number;                         // drives the Goals tab dot and the arrival pop-up
  lastFeedbackAt: string | null;                  // date of the latest coach feedback (adults set it with the feedback)
}
type GoalStatus = "Haven't started" | "Stuck" | "Making progress" | "Almost there" | "Got it";
type GoalState = "active" | "paused" | "done" | "changed";

// goals/{goalId}/events/{eventId}
interface GoalEvent {
  type: "created" | "checkin" | "feedback" | "reply" | "paused" | "resumed" | "completed" | "changed" | "edit";
  authorId: string; teamId: string;               // the student's team when this was written
  date: string; createdAt: Timestamp;
  status?: GoalStatus; taskIds?: string[]; note?: string;          // check-in
  planResult?: "It worked" | "It didn't work" | "It didn't come up"; newPlan?: string;
  nextSteps?: { title: string; taskId: string; sprintId: string }[];
  text?: string; replyTo?: string; aboutEventId?: string;            // feedback / reply
  reason?: string; change?: string; to?: string;                      // pause / edit / changed
}
```
- The student writes the summary and goal together in one batch, so the statement and status stay in sync.
- **Goals follow students.** When a coach moves a student to another team, the same batch updates `teamId` on that
  student's goals and summaries. Their new team's mentors then see them.
- **"Can't see other teams' coaches' comments"**: a mentor can read a goal's events only if `event.teamId` is one of their
  teams. This is a little stricter than the mock-up: it also hides the student's own check-ins from their previous team
  (decided). The student and program coaches see everything.
- **Feedback is visible to every coach of the team**, never a private 1:1 channel. That rule is in the security rules.

### `userState/{uid}`: per-person, only that person reads it
```ts
interface UserState {
  announcementsRead: Record<string, true>;        // announcementId → true
  dismissed: Record<string, string>;              // pop-ups dismissed with "Later" (until a date)
}
```

## Who can do what (enforced in `firestore.rules`)

| Data | Read | Write |
|---|---|---|
| Program settings, subteam defaults | members | program coaches |
| `public/signIn` (name, sign-in methods) | anyone | program coaches |
| Members (roster) | members | coaches: anyone; mentors: students/leads on their teams; leads: subteams only; the person themself: creating from their invite |
| Contact email, invites | coaches (mentors: invites for their teams) | coaches; mentors for their teams |
| Team profile, subteams, GitHub | the team | coaches, the team's mentors |
| Sprints, objectives | the team | leads, mentors, coaches (students can't edit objectives) |
| Tasks, subtasks, comments | the team | anyone on the team; hard delete: adults, archived tasks only; type "GitHub issue" can't be set or changed by users |
| Team events, Team Home | the team | anyone on the team |
| Program events | members | program coaches |
| Announcements | members whose team is in `audience`, or `"all"` | author = self; students: own team only; mentors: their teams; coaches: anything |
| Huddles | adults | program coaches; adults may add themselves to `readBy` |
| Goal summaries | the student's team | the student (with the goal); coaches |
| Goals | the student, mentors of the student's current team, coaches | the student; adults: only `unreadFeedback` and `lastFeedbackAt` |
| Goal events | the student, coaches, mentors when `event.teamId` is one of theirs | student: check-ins, replies, pauses; adults: feedback |
| `userState` | self | self |

Rules read the caller's member doc with `get()`, which counts as one read per request. Custom claims would avoid that
cost, but setting them needs the Admin SDK (Cloud Functions, so the Blaze plan). At ~100 users the extra reads are fine.

## Queries the app runs

These live in `src/data/queries.ts`, and `tests/rules/queries.test.ts` runs each one as the roles that use it.

| View | Query (all under `programs/{p}`) |
|---|---|
| Board, List, Timeline | `teams/{t}/tasks` where `sprintId == current`, `archived == null`, order by `rank` |
| My Tasks | the same + `assigneeIds array-contains uid` |
| Planning | `teams/{t}/tasks` where `archived == null`, order by `rank` (grouped by sprint in the app; one team ≈ dozens of tasks) |
| Archived tasks | `teams/{t}/tasks` where `archived != null` |
| Sprints and objectives | `teams/{t}/sprints` where `seasonId == current`, order by `index` |
| Roster | `members` where `teamIds array-contains t` (+ coaches) |
| Team Home | `teams/{t}/pages/home`, `teams/{t}/events`, `events` |
| Announcements | `announcements` where `audience array-contains-any [t, "all"]`, order by `postedAt` |
| Team goal cards | `goalSummaries` where `teamId == t`, `state == "active"` |
| My goals | `goals` where `studentId == uid` |
| Coaches' Dashboard: Tasks / Goals | one listener per team (7 teams), or `goals` where `teamId in [...]` (up to 30 values) |
| A student's goals, all teams (program coaches) | `goals` where `studentId == s` |
| Program settings | `teams` (all seasons), `members` order by `displayName`, `invites` |
| A goal's history | `goals/{g}/events` order by `createdAt`; **mentors add `teamId in [their teams]`**, or the rules refuse the whole query |
| Huddle | `huddles` order by `postedAt desc`, limit 20 |

**Composite indexes needed** (in `firestore.indexes.json`): tasks (`sprintId`, `archived`, `rank`), tasks
(`assigneeIds`, `sprintId`, `archived`), tasks (`archived`, `rank`), announcements (`audience`, `postedAt`), goalSummaries
(`teamId`, `state`), sprints (`seasonId`, `index`), goal events (`teamId`, `createdAt`). The emulator doesn't check
indexes, so a query missing one only fails on a real project: add it here when adding a query.

**Free-plan estimate:** opening a team reads ~60 tasks + ~14 sprints + ~10 members + ~10 announcements ≈ 100 docs. At 100
users × a few sessions a day, that's roughly 20–40k reads/day, under Spark's 50k. The offline cache cuts repeat reads.
Keep an eye on this once real usage starts; the first thing to trim would be listening only to the current sprint.

## Things that need a server later (Blaze plan, or a GitHub Action / Apps Script)

- **Email** for announcements and huddles (pending the approved email method).
- **GitHub sync** (new issues → Backlog tasks; closed → Done). The sync writes with a service account, which bypasses the
  rules, so users can't fake an issue.
- **Deleting Auth accounts** when someone leaves. Their Firestore data can be removed from the app by a coach; the Auth
  record is removed in the Firebase console or by a function.

## Deletion and retention (designed in from the start)

- **Remove a person:** a coach deletes their member doc and contact doc and takes them off every task (`assigneeIds`). Their
  comments stay and show "Former member". Whether those comments should be deleted or kept is pending the retention rules.
- **Delete a student's data** (when retention requires it): delete their goals, goal events, and summaries, plus their
  comments. A coach-only "Delete all data for this student" action runs this as batched writes from the app.
- **Delete a team:** tasks, sprints, events, and pages go; members become "No team"; goals stay with the students.
- Hard deletes are adult-only. Archived tasks can be restored until an adult deletes them.

## Open questions

Decided:
- **Team leads don't see "Checked in …" dates.** They're students and can't read the private goal doc; only adults see
  check-in dates on team goal cards.
- **Mentors and a moved student's old history:** a mentor sees only goal events written while the student was on one of
  their teams (including the student's own earlier check-ins). Program coaches see everything.

Still open:
1. **Team chat** isn't modeled yet (pending Google Chat vs. built-in).

Resolved by the rules tests: the single announcements query (`audience array-contains-any [team, "all"]`) is allowed
under the audience rule, so no two-listener fallback is needed.
