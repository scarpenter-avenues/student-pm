# Switchback

Project management for student teams (boards, sprints, a timeline) plus learning goals and tools for coaches. MIT
license, open source. Each school or club runs its own copy in its own Firebase project.

This file is for an agent helping someone edit the project. Read "Rules that don't bend" before changing anything.
For a gentler walk through the code, read `docs/code-tour.md`; for what is stored and who may read it,
`docs/data-model.md`.

## Rules that don't bend

Students use this, including some under 13. These rules outrank any feature request; if a request conflicts with one,
say so and explain the trade-off before doing anything.

1. **Store very little.** Auth UID, email, display name (first name and last initial), role, team, and what people
   create. Don't add fields or features that invite students to type personal details. Member lists never show emails.
2. **Access is enforced in `firestore.rules`, never only in the interface.** Hiding a button is a courtesy. A change
   to who can read or write something changes the rules, a test in `tests/rules/`, and the access table in
   `docs/data-model.md`, together. Every `update` rule checks the document before and after the change as strictly
   as `create` (three real holes were found this way).
3. **Students see only their own team's work and their own goals.** Teammates see a goal's statement and status,
   nothing else. That is why goals are split into `goalSummaries` (team-readable) and private `goals` + `events`.
4. **No private adult-to-student channels.** Coach feedback on a goal is visible to every coach of that team. No DMs.
5. **No third-party requests.** No ads, analytics, trackers, CDNs, or remote fonts. Everything is bundled from npm.
6. **Stored HTML is never rendered with `v-html`.** Use `RichText.vue`, which renders through Tiptap's schema.
7. **No real people, schools, or deployments in the repo.** Sample data is "Example Robotics" at `example.edu`. Each
   deployment describes itself in `program.config.json`, which is never committed, and neither are `.env.local`,
   `.env.*.local`, service-account keys, or `dist-email/`. Before a commit, check the diff for project IDs, keys,
   tokens, and personal addresses.
8. **Secrets live outside the code.** The email and GitHub jobs keep theirs in Apps Script properties.

## Running it

Node 22.18+ (or 24.12+) and Java 21+ (for the emulators). No Firebase account is needed for any of this.

```sh
npm install
npm start              # Firebase emulators + the app at http://localhost:5173
npm run seed:demo      # second terminal; CLEARS the emulator, then loads the sample program
```

Sign in with Google and pick a sample person in the emulator's pop-up:

| Account | Shows |
|---|---|
| `avery.k@example.edu` | A student whose sprint check-in is due (the check-in pop-up appears) |
| `mina.l@example.edu` | A student with no goal yet |
| `jordan.m@example.edu` | A team lead whose goal date has passed |
| `ms.patel@example.edu` | A mentor |
| `coach.rivera@example.edu` | A program coach (lands on Coaches' Dashboard → Huddle) |
| `okafor.volunteer@gmail.com` / `switchback-demo` | An outside mentor who signs in with a password |

Emulators: Auth 9099, Firestore 8080, Hosting 5000, UI 4000; project `demo-switchback`; data kept in
`.emulator-data/`. `npm run dev` alone runs the app in `--mode emulator` (`.env.emulator`, committed, no secrets).
"Port taken" on start usually means an emulator from an earlier run is still alive.

## Checks

Run what CI runs (`.github/workflows/ci.yml`: three jobs, all on emulators, no secrets) before calling work done:

```sh
npx prettier --check src e2e tests scripts   # npm run format fixes
npm run lint                                 # oxlint + eslint (these --fix locally)
npm run type-check
npm run test:unit -- --run                   # Vitest
npm run test:rules                           # starts its own emulator; test:rules:live uses the one from npm start
npm run test:e2e                             # Playwright, Chromium; needs npm start and npm run seed:demo
npm run build
npm run build:email                          # only if scripts/email or scripts/github changed
```

- Rules tests use their own project id (`demo-switchback-rules`), so they never clear the demo data. Files run one
  at a time; `tests/rules/setup.ts` seeds a small program with a person for each role and sign-in method.
- `tests/rules/queries.test.ts` runs the app's own queries and writes as each role. A new query or write belongs
  there too: a query the rules refuse fails silently in the app as an empty list.
- e2e gotchas: anchor URL patterns (`/list$` also matches `/sign-in?next=…/list`); the huddle pop-up appears once
  data loads and again after a full reload, so dismiss it after each navigation; the Auth emulator's Google pop-up
  loads from a CDN and sometimes ignores clicks, so retry until it closes.
- For a one-off visual check, a throwaway Playwright script against the dev server is the normal tool. Touch tests
  send real touch events through the DevTools protocol and fake an iPhone by user agent (SortableJS decides by it).

## Where things live

```
src/
  firebase.ts     the only place that connects to Firebase
  model/          plain logic and types; no Vue, no Firebase; unit-tested (types, dates, sprints, rank, subtasks,
                  goals, huddles, csv, signIn, slug)
  data/           the only code that touches Firestore: refs, queries, writes, admin (multi-document changes), live
  stores/         Pinia: session, taskPanel, taskFilters, goalFlow, toast
  composables/    useTeamData, useTaskView, useTaskEdits, useSelection, useGoals, useGoalActions, useInbox, …
  router/         index.ts (routes, scrollBehavior), access.ts (decide(): the guard, a pure tested function), tabs.ts
  ui/             screen helpers: format, teamColor, dragSort, timeline, mentions, calendar
  components/     ui/ (shared controls), tasks/, goals/, huddle/, home/, settings/, program/, dashboard/,
                  AppShell, TopBar, TaskPanel
  views/          team/ (one per team tab), dashboard/ (one per dashboard tab), SignIn, Announcements, Huddle,
                  dev/ComponentsView (a gallery at /dev/components, dev server only)
  styles/         base.css (tokens, shared controls), tables.css, goals.css
firestore.rules   who can read and write what
scripts/          setup.ts, seed-demo.ts + demo/data.ts, lib/, email/, github/
tests/rules/      security-rule tests        e2e/   browser tests        docs/   guides
mockup/index.html the original clickable design (see "The mock-up")
```

### How the pieces fit

- **Everything is under `programs/{programId}`.** People are invited by email (`invites/{email}`) and the invite is
  claimed at first sign-in, which creates the member doc. Display names come from the invite, never from Google.
  After that, emails live only in Firebase Authentication, not Firestore.
- **Session** (`stores/session.ts`): phases `starting → signedOut | verifyEmail → joining → ready | noAccess |
  failed`. It refuses the wrong kind of account up front (a Google account off the program's domains, or a password
  on them). Signing out clears Firestore's local cache and reloads, so shared Chromebooks keep nothing.
- **Sign-in methods** are per program (`program.config.json`): Google restricted to the program's domains, email and
  password (optionally limited by role), or both. `src/model/signIn.ts` is shared with `scripts/lib/config.ts` and
  mirrored in the rules. `programs/{p}/public/signIn` is the one publicly readable doc, so the sign-in page can show
  the right buttons.
- **Data layer**: `createRefs` / `createQueries` / `createWrites` take a Firestore instance, so tests can run them as
  any role; `data/index.ts` binds them for the app. `useLiveQuery(() => query | null)` returns `{ data, loading,
  error, fromCache }` and re-subscribes only when the query really changes. **Writes resolve only when the server
  confirms** (offline they wait), so screens never `await` one before updating; they `.catch` and show a toast.
- **Team data**: `AppShell` provides `createTeamData(teamId)` (`useTeam()`): the team, sprints, every unarchived task
  in one listener, the roster, and `can.*` permissions. The task panel and each dashboard group create their own.
- **Order is `rank`**, a fractional index (`model/rank.ts`); moving a task changes only its own rank. Sort is rank,
  then id. **Subtasks are an ordered list inside the task document**, so any subtask change saves the whole list.
- **Dates are plain `"YYYY-MM-DD"` text** (`model/dates.ts`). Don't introduce `Date` arithmetic in views.
- **Scripts** use the Admin SDK and bypass the rules. `npm run setup` (`--emulator`, `--project`, `--config`,
  `--dry-run`) is idempotent and lists every config problem in plain words. Running it against a real project is the
  maintainer's job, not an agent's.

## Product decisions

These were decided deliberately. Don't undo one as a side effect of something else.

**Roles.** Student · Team lead · Mentor (team-scoped adult; may be on several teams; no Coaches' Dashboard) · Program
coach (everything, across teams). Leads can edit their team's name, number, color, subteams, and GitHub settings, and
plan sprints. Members, roles, and permanently deleting archived tasks stay with mentors and coaches. Anyone can post
an announcement to their own team. Where someone can't edit a settings section, a small 🔒 note says who can.

**Tasks.**
- **Order is priority.** There is no priority field, on purpose.
- **Status is how things get done.** There are no "done" circles: a circle on a row means *select*. The one exception
  is the square checkbox on a Board card's subtasks, because the Board has no Status column.
- **Archive, not delete.** Archive has Undo; Team Settings lists archived tasks with Restore; only adults can delete
  for good.
- **Subtasks aren't full tasks**: no subtasks of their own, and they never move to another task. "Make it a task"
  promotes one (its comments stay on the parent, since moving them would mean deleting other people's comments).
- Types are Task · Learning · Idea. "GitHub issue" is set only by the sync and is locked.
- Subteam is multi-select everywhere. Dates are chosen with a picker, never typed.
- **My Tasks is deliberately the simplest view**: the current sprint, yours, no filters.
- Column order in tables: Name · Status · Due date · Assignee · Subteam · Type.

**Views.**
- Progressive disclosure: students get the simple views; Planning and Timeline are for leads and adults.
- **Timeline**: one task per row in Planning's order, under subteam header rows (a toolbar checkbox turns grouping
  off). Sprint boundaries are the only solid lines. A "Later" column appears when a task starts off-screen. Bars drag
  to move or resize with a mouse or pen; touch scrolls instead.
- **Phones**: except in Planning, Board, List, and Timeline, nothing scrolls sideways, neither the page nor a box in
  it. In portrait at 680px and under, the Planning and Timeline tabs are hidden (the pages still open by link) and
  tables show the name and Status before any swipe.
- **Announcement banner** shows every unread post in full; "Mark read" is how one goes away.

**Goals** (based on WOOP and implementation intentions).
- Wizard: what to learn → how you'll know → by when → obstacle → if-then plan → first step (becomes a Learning task)
  → review. Up to 3 active goals.
- Status scale: Haven't started · Stuck · Making progress · Almost there · Got it. **Never "Not yet"** as a label.
- A check-in each sprint, by pop-up on arrival; "Later" is remembered for the browser tab only. Pause uses tap-only
  reasons (no free text). A passed date offers Keep going · I got it · Change my goal · Pause it.
- The idea chips in the wizard are editable per program (Program settings → Goal ideas), so non-robotics programs can
  fit it to themselves. Keep built-in wording generic.
- Coaches see a "Needs" column (Check-in overdue · Date passed · Needs feedback · No goal yet · Goal paused). Blank
  means fine; there are no "On track" chips.

**Huddle** (adults only): a dated status, a timed plan (time · what · run by · who), and quick notes, with @ mentions.
Editing a posted huddle doesn't notify anyone again. The composer warns to keep student health, family, and
discipline details out.

**Optional background jobs** (one Google Apps Script, bundled by `npm run build:email` into `dist-email/Code.gs`;
written in TypeScript here so they can be tested; all IO is synchronous, like Apps Script's):
- **Email** (`scripts/email/`, `docs/email.md`): a post writes `outbox/{kind}-{sourceId}` in the same batch (no
  addresses, no text). The sender claims each item with an "only if unchanged" commit, reads addresses from Firebase
  Authentication, blind-copies, and sends plain text. Students are emailed only with `INCLUDE_STUDENTS=true`. It
  can't deliver when the organization's mail isn't hosted by Google (DMARC); the doc opens with that check.
- **GitHub sync** (`scripts/github/`, `docs/github.md`): one way, GitHub → Switchback. Copies title (cut to the
  rules' 90-character limit), number, link, state, and the description as plain text. Never authors, assignees,
  labels, or comments: GitHub requires users to be 13+, and no profiles should reach the database.
- The app offers either feature only after its `install` function has switched it on in the program doc.

**Not built:** reminders for coaches. **On hold:** team chat (privacy concerns, and students default to their own
chat apps anyway).

## Design preferences

The maintainer's taste, learned over many rounds. Apply it without being asked.

- **Less on the screen.** No subtitles or eyebrows that restate the page name, no placeholder or example text that
  isn't needed, no notes explaining the obvious.
- **Dense planning views**: 12px text, ~29px rows, one pinned column header, fixed column widths.
- Whitespace separates groups; don't add rules or lines between them.
- No chip for the default case ("All teams"); chips are for exceptions.
- Task, student, and goal names are semibold 13px, near-black.
- Per-row controls (⠿ handle, Move to, role and team dropdowns) stay hidden until hover or focus; on touch they show.
- Team chips use the team's own color. One team picker everywhere: radios for one team, checkboxes plus "All teams"
  for several.
- Sentence case. Plain words in every message a student might read, including errors.
- Collapsing or truncating a list is often declined ("keep all sprints shown"). Offer it; don't push.
- UI tweaks are made directly, without a discussion of alternatives, unless one conflicts with the rules at the top.

## Conventions

- **Comments** (students read this code): every file starts with a comment saying what it is for (inside
  `<script setup>` in `.vue` files). Every function that isn't an obvious one-liner has a comment saying what it does
  or why, in plain words. Exported things use `/** */`, the rest `//`. When code changes, its comment changes in the
  same edit.
- **Shared controls** live in `src/components/ui/` and are shown in the dev gallery (`/dev/components`, tested by
  `e2e/components.spec.ts`). Use them rather than building a one-off; dates are always picked from `CalendarPopover`, never typed or left to a native date input.
- **Floating parts** (menus, calendars) are teleported to `<body>` with `position: fixed`, z-index 55: above dialogs
  (50), below toasts (60). Teleported roots can't use scoped styles, so their CSS is in `base.css`.
- **Team colors** go through `teamColorOf()` / `teamAccent()`, which set the `--team-*` variables. Stored colors
  never reach CSS unchecked.
- Keep docs current: a feature change updates the README's status list or the relevant `docs/` page, and this file
  if a decision or convention changed.
- Commit and push only when asked.

## Gotchas already paid for

- A `display: grid` with no column grows to fit a one-line child. Give it `grid-template-columns: minmax(0, 1fr)`.
- A scoped style doesn't reach another component's root element. Use `:deep(...)`.
- Dashboard totals computed across child groups must stay plain numbers, or the page re-renders forever.
- **Drag and drop** (`src/ui/dragSort.ts`, the `v-drag-sort` directive over SortableJS): on drop the DOM is put back
  and the view saves status or sprint plus a new rank; the live listener redraws. The floating copy must have
  `transition: none` (a hover transition made it trail the pointer) and must live on `<body>` (`fallbackOnBody`),
  except table rows, whose copy stays in the table and is sized by `sizeRowCopy`. On iOS SortableJS positions the
  copy in the page, so the scrolling wrappers are `position: relative` and the page never scrolls sideways during a
  drag (`scrollFn`). Touch needs a 160ms hold so a swipe still scrolls.
- The Firestore emulator ignores `currentDocument.updateTime` in a PATCH URL; preconditions go in a `:commit` body.
- Firebase 13 pins a vulnerable `@grpc/grpc-js`; `package.json` overrides it. `npm audit --omit=dev` must stay clean.
- Deleting a team archives its tasks first, because the rules only allow deleting archived tasks.

## The mock-up

`mockup/index.html` is the original single-file design, where the UI was worked out before the app existed. The app
has since moved past it (goal pop-ups, huddles, drag and drop, the Timeline, phone layouts), so **the app is the
reference now**. Don't port changes back to the mock-up, and don't treat a difference from it as a bug.
