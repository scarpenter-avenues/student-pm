# Robotics Team Management App — mock-up

A UI mock-up for a custom web app to manage 7 FTC robotics teams (students ~13, some under 13) at Avenues. It replaces GitHub Projects, which is clunky for students; the school won't approve Asana, Monday, or Trello because of student data privacy. The current goal is to **finish the UI design before building the real app or connecting data**.

Everything lives in one self-contained file: `index.html` (HTML, CSS, and a classic `<script>`, plus one `<script type="module">` for the Tiptap editor). There is no build step: open the file in Chrome.

## Project brief (summary)

- **Planned stack:** web app (Chromebooks and phones), React or Svelte (undecided), Firebase Auth with two sign-in flows: Google sign-in (Avenues will use this, restricted to the school's Workspace accounts) and email/password (for other programs, e.g. community teams, that choose it); each program picks its flow, Firestore, Hosting, ideally under the school's Google account. About 100 daily users, so it should fit the free Spark plan; scope queries to the user's team. Cloud Functions would need the Blaze plan.
- **Features:** team boards (Trello-simple), coach dashboard across teams, student goal tracker with coach feedback, team home/wiki pages, announcements (in-app plus email), team chat (team channels only, no DMs), and PM features (subtasks, backlog, sprints, timeline).
- **Privacy (COPPA):**
  - Store only the auth UID, school email, display name, team, and user-created content.
  - Enforce access in Firestore security rules, not just the UI.
  - Students see only their own team's data and their own goals. Exception, decided below: teammates see goal *statement and status*.
  - No ads or trackers. No AI training on student data.
  - Design deletion and review in from the start.
  - Coach goal feedback must be visible to more than one coach (no private 1:1 adult–student channels).
  - Don't build features that invite students to type personal info.
- **Pending admin approval (no real student data until approved):** COPPA consent on parents' behalf, whether Firebase is covered by Workspace for Education, retention rules, Google Chat vs. built-in chat, the approved email method, coach–student communication policy, and the approval process for internal tools. **Add:** teammates seeing goal statements and status. Avenues keeps Google sign-in inside its Workspace, so non-school emails don't apply here; programs that choose email/password own their own consent for under-13 students. (The mock-up accepts any valid email in Add person, Add member, and CSV import.)
- **Design direction:** progressive disclosure (students get a simple view; sprints, backlog, and timeline are for leads and coaches). Trello's approachability, Linear's restraint, Asana's timeline and subtasks. Avoid Monday/ClickUp clutter.

## How the mock-up works

- **Demo roles:** use the profile button (top right, shows initials) → **Preview as**:
  - Student (Avery K.) — the default on load (`demoRole`). Her Sprint 2 check-in is overdue, so the check-in pop-up appears on load. Avery also has one paused goal.
  - Student · no goal yet (Mina L.) — shows the set-a-goal pop-up and setup.
  - Team lead (Jordan M.) — Jordan's goal date (End of Sprint 2) has passed, so the "date passed" pop-up appears.
  - Team mentor (Ms. Patel)
  - Program coach (Coach Rivera). Program coaches land on **Coaches' Dashboard → Huddle** (on load and when switching to this role; `orgTab` defaults to `huddle`).
- **"Later" on goal pop-ups** is remembered for the browser tab's session (`sessionStorage`), so it won't reappear on refresh. Use a new tab to see it again.
- **Today's date** comes from the real clock (`todayIso()`). Sample data was written around Oct 6, 2026.
- **Circuit Breakers (FTC 418)** is the only "live" team with full task data. The other six teams (Gear Grinders, Bolt Brigade, Torque Titans, Servo Squad, Pixel Pilots, Iron Owls) have sample tasks, members, sprint calendars, and goals for the coach views. Switching to them in team mode shows Circuit Breakers' tasks, with a toast saying so.
- **Data model:** the board's task cards (DOM `dataset`) and the Backlog's task records (plain objects) are still **separate data sets**. This was deliberately deferred until the UI is final. Fields are shared (title, type, subteam, assignee, start, due, state/status, detail). Assignees are stored as a `"|"`-joined string. Unifying these into one Firestore-shaped store is the next big step.
- **Tiptap** (v3.31.4) loads from esm.sh via `window.createRichEditor()` in the module script. It powers Team Home, announcement bodies, and task descriptions. In the real app, bundle it from npm; loading from a CDN means third-party requests, which conflicts with the no-trackers rule.

## What's built (by area)

- **Top bar:** team badge (an icon or a colored number block) plus the team name. Program coaches get a ⌄ switcher: Coaches' Dashboard and every team; team mentors get one only if they mentor more than one team (no dashboard). Also the Huddle button (adults, unread count), the Announcements button (with unread count) and the profile/preview menu.
- **Announcement banner** (on task tabs): lists *every* unread announcement, each with its own "Mark read". There is no "Mark all read" or "All announcements" link.
- **Team tabs:** Team Home · Planning · My Tasks · Board · List · Timeline · Goals · Settings (gear icon, right-aligned).
- **My Tasks:** the Board filtered to the signed-in user (assignee filter hidden, empty columns kept, ＋ Add task pre-assigns you).
- **Team Home:**
  - No page heading, subtitle, or ＋ Announcement button (removed as clutter; announcements are posted from the Announcements page).
  - Tiptap notes with Edit / Cancel / Save floating at the top right of the notes area.
  - Events column: the real 2026–27 calendar.
    - Shows the next 5 upcoming events, then "Show all upcoming (N)"; titles wrap to two lines (location stays one line).
    - Program-wide events carry no chip (most events are program-wide); only program coaches can edit them.
    - Each team has one Nov/Dec and one Jan/Feb qualifier, picked by a name-seeded hash so they're stable across loads.
    - Super Qualifiers and the NYC Championship are marked "If qualified" and are skipped by the countdown.
    - The family social and open lab events were removed at the user's request.
- **Sprint objectives** (Board / List / Timeline, under the sprint title): one line each (max 80 characters), subteam tags, met checkbox, competition countdown chip, collapsible. The sprint dropdown includes **All sprints**, which groups objectives by sprint.
- **Planning tab** (formerly "Backlog"; code still calls it `backlog`, and the unplanned pool section is still named Backlog):
  - Dense planning view: 12px text, ~29px rows; sprint headers have 11px padding above and below (names centered between the lines) and 24px of space under the Backlog.
  - One pinned column header at the top (no per-section headers); fixed column widths so sections line up.
  - Collapsible sprint sections, each with a collapsible Objectives panel (collapsed by default). All sprints stay listed; no "Upcoming" label; section counts show only non-empty parts ("2 objectives", "3 tasks", or nothing).
  - Click a sprint's dates to edit them.
  - **Move to ▾** button per row, and a Sprint field in the task panel.
- **Board:**
  - Columns tinted with the team color; each column scrolls on its own.
  - The board is exactly one screen tall, so when scrolled to the bottom the column titles sit under the top bar.
  - Cards show the subteam tag top-right.
- **No priority field (order is priority):** like Scrum's *ordered* backlog and Trello/Kanban, tasks are ranked by position, highest first; the coach teaches students to rank. Priority was removed from every view, the task panel, bulk actions, drafts, and data.
  - Reorder with the ⠿ handle (shows on hover/focus at the left of List and Planning rows and the top-left of board cards): Move to top / up / down / bottom. **Alt+↑ / Alt+↓** moves the focused row or card. Board and List share the board column order; Planning orders each section's `taskRecords`. Drag-and-drop replaces this in the React build.
- **Column order:** Planning is Name · Status · Due date · Assignee · Subteam · Type, then a Move to column (the button shows only on the hovered/focused row). Dashboard Tasks is the same without Type. List is still Name · Type · Subteam · Assignee · Due date · Status (to revisit on its page). Task names are semibold 13px in Planning and Dashboard Tasks. Subteam cells use the colored tags.
- **No done-circles anywhere** (circles mean select): tasks and subtasks are marked done by changing Status (task panel, Status column, a per-subtask status menu in the task panel, and inline in List/Backlog subtask rows). Exception: board card subtasks have a square checkbox to the right of the text (Done ↔ To do), since the board has no Status column; done subtasks get strikethrough.
- **Multi-select in list views** (List, Planning, Coaches' Dashboard Tasks): the row circle **selects** the row and fills like a radio button. Shift-click selects a range; Esc or Clear deselects; switching tabs clears. A floating bulk bar appears at the bottom:
  - Planning: Move to · Status · Assign (Move to clears the selection afterward).
  - List: Status · Assign.
  - Dashboard: Status only (teams have different rosters).
  - Assign adds a person to each task (or Unassign). There's no bulk Delete because there's no single-task delete yet.
  - Subtask rows in List and Backlog are selectable too and can be mixed with tasks (Status · Assign apply to both). Move to appears only when a task is selected; subtasks travel with their parent.
- **Timeline:**
  - Grouped by subteam; status shown by bar color plus icon (gray/orange/green = To do/In progress/Done).
  - Event markers and lines; dense rows (34px).
  - Expandable subtask panels for tasks that have dated subtasks.
- **Task panel:**
  - Multi-assignee picker (chips, type-to-filter; no emails, no invite).
  - Start and due dates are **picker-only** (typing is blocked everywhere).
  - Tiptap description; subtasks; comments.
- **Goals tab (team):**
  - Students see "My goal" plus team goal cards. Teammates see only the statement and status.
  - Adults see the team cards plus a pointer to the Coaches' Dashboard, which is where review happens.
- **Goal design (research-based: WOOP / mental contrasting, implementation intentions, learning goals):**
  - **Setup steps:** intro → learn (the user's 7 ideas) → evidence (the user's 3 ideas) → by when → obstacle → if-then plan (pre-filled from the obstacle) → first step (fill-in-the-blank starters; blanks must be filled; becomes a Learning task in the current sprint) → review. "Your team will see" shows the statement and status only.
  - **Edit** opens on the review screen.
  - Goals read as written, verb-first, e.g. "Learn Java for FTC".
  - **Status scale:** Haven't started · Stuck · Making progress · Almost there · Got it. Avoid "Not yet": it's the school's lowest grade.
  - **Multiple goals:** up to 3 active at once (`maxActiveGoals`). "＋ New goal" on My goal; the wizard intro says "Add another goal" when one exists. Each goal gets its own check-in, Edit, and Pause.
  - **Pause:** tap-only reasons (no free text). Paused goals skip check-ins, are hidden from teammates, and sit in a **Paused goals** container under My goal with Resume. Coaches see them in student detail and as a "Goal paused" dashboard flag/filter.
  - **Date passed:** when an active goal's "by" date is past → Keep going (wizard opens on the By step) · I got it (reflection) · Change my goal (new goal; old one becomes "Changed" in history) · Pause it. Dashboard flag/filter "Date passed".
  - **Arrival pop-up** covers every active goal: no goal (or only paused goals → Resume / Set a new goal), due check-ins, passed dates, new feedback. "Start (N steps)" runs them in a queue (`goalQueue`; date decisions before check-ins; Cancel drops the rest).
  - **Check-in each sprint**, by pop-up on arrival when due (or when there's new feedback, or the student has no goal):
    1. Status.
    2. Evidence = finished tasks *in the covered sprint*; tasks from this goal are listed first and pre-ticked.
    3. Did the plan work? If not, rewrite it.
    4. Next steps: multiple rows, each with a current/next sprint picker; each becomes a Learning task linked to the goal.
  - **"Got it"** → reflection questions → goal history → offer to set the next goal.
  - **Timeline per goal** with coach feedback and student replies, visible to the student and the team's coaches.
  - **My goal history:** grouped by season; goals follow students across teams.
- **Roles and permissions:**
  - **Student / Team lead:** leads can edit subteam assignments.
  - **Team mentor:** team-scoped adult; only the team(s) they're assigned to (`mentorTeams()`, from team rosters). **No Coaches' Dashboard** (so no program settings). Keeps full access to their team's Settings tab (team look, members, CSV import, subteams). Reviews goals in the team **Goals tab**: student cards show warn/alert flags and open the student detail (timeline, feedback composer) in place. Can't see comments written by other teams' coaches on a student's earlier goals.
  - **Program coach:** org-wide. Sees everything; can post program-wide announcements and events.
  - Anyone can post an announcement to their own team.
- **Huddle** (adults only): the coaches' and mentors' daily status and session plan.
  - Program coaches post from **Coaches' Dashboard → Huddle** (first tab): session date (picker), "Where things stand" (Tiptap), a timed plan (time · what · who: a multi-select of All teams (exclusive) / Coaches & mentors / any teams, shown as one chip each; stored as `teams` arrays; "Copy plan from <last huddle>"), and optional "Heads-ups and needs" (Tiptap). Rich fields store `statusHtml`/`notesHtml` (editor-serialized) plus plain-text `status`/`notes`. Hint warns to keep student health, family, and discipline details out.
  - Posting "emails" every coach and mentor (mocked as a toast; pending the approved email method) and shows a **sign-in pop-up** with the newest unread huddle (Later = this browser session · See all huddles · Got it).
  - **Huddle** top-bar button (adults; unread count) opens the dashboard tab for program coaches, or a read-only Huddle page for mentors. Opening the page marks all read. Cards show "seen by N of M" (adults across team rosters).
  - **Quick note** (button beside "＋ Post today's huddle"; program coaches): a Tiptap message, no length cap (stores `textHtml` plus plain `text`; Cmd/Ctrl+Enter sends; Esc cancels). Same email and sign-in pop-up as a huddle; shown in the feed as a slim "Quick note" card. The pop-up lists every unread item (newest first, up to 3; "Got it" marks those read).
  - Data: `huddles` (`readBy` is a Set; quick notes have `kind: "note"` and `text`). Sample: yesterday's (read by Ms. Patel) and today's (unread for her).
- **Coaches' Dashboard** (program coaches only; from the ⌄ menu; dark "All" badge):
  - Tabs: Huddle · **Announcements** · Tasks · Goals · ⚙ Settings. Announcements reuses the announcements page (`openAnnouncements()`): in the dashboard it hides "← Back to team board", its eyebrow reads "Coaches' Dashboard · All teams", and new posts default to all teams. **Send to** in the composer is the same team picker as Add person (`teamChecklist` with `options`): program coaches pick any teams (All teams = program-wide), mentors pick among their teams ("All my teams"), students get their own team. Every post shows its audience beside the title: one team-color chip per team, or the dark "All teams" pill (`audienceChips`). **Visibility** (`visibleAnnouncements()`): the dashboard sees every post; a team view (list, banner, unread count) sees only its team's and program-wide posts. Samples: two Circuit Breakers posts, one program-wide, one Gear Grinders post from Mr. Okafor. The page has no subtitle, and no eyebrow on the dashboard. The top-bar Announcements button opens this tab while on the dashboard.
  - **Tasks** (tab was "All tasks"): grouped by team; sprint filter (Previous / Current / Next / All Tasks), relative to each team's own sprints. The status filter is multi-select (`mountMultiFilter`, a reusable checklist dropdown; nothing or everything ticked = "Any status"). Columns: Name (semibold 13px) · Status · Due date · Assignee · Subteam; rows keep each team's own order; whitespace (no rule) between team groups. Subtasks are collapsed by default: a ▸ toggle plus a "done/total ☷" count beside the name (either expands); expanded subtask rows show status, due, assignee, subteam, open their own detail panel, and are selectable for bulk Status. Sample subtasks: Gear Grinders "Rebuild lift string routing", Pixel Pilots "Vision pipeline for samples".
- **Icons:** the Settings gear is Lucide's `settings` icon (lucide-static v1.53.0, ISC license; credited in an HTML comment).
  - **Goals:** grouped by team, one row per active goal (student name on the first). Columns: Student · Goal (both semibold 13px) · Status · Last check-in · **Needs**. A **Needs attention / Everyone** toggle (default Needs attention) replaces the old status and attention dropdowns; plus team filter and search. Students who need something sort first; group headers say only "N need you"; whitespace (no rule) between teams.
    - Needs (`coachNeeds()`, most urgent first, max 2 chips + "+N"): Check-in overdue · Date passed · Needs feedback (merges "no coach feedback yet", "new goal", and "check-in needs a response") · No goal yet · Goal paused. "Stuck" isn't repeated (Status shows it) but still counts as needing attention. No "On track" chips: blank means fine. Mentors' team Goals cards use the same wording.
- **Archive (instead of delete):**
  - **Archive** button in the task panel toolbar (hidden while creating a task), plus Archive in the bulk bar. Works on board cards, Planning tasks, the other teams' dashboard tasks, and subtasks.
  - Archived tasks vanish from every view (Board, List, Timeline, Planning, dashboard) but keep their subtasks and comments. The toast offers **Undo** (6 seconds); restoring puts a task back at its old position.
  - **Settings → Archived tasks** lists them (subteam tag, title, type, where it was, who archived it and when) with **Restore** for anyone and **Delete** (permanent, with a confirm row) for mentors and coaches only.
  - Archived tasks still follow roster and subteam changes (`eachTaskRecord` includes them). Store: `archivedTasks` (entries hold the record, kind, origin and index). In Firestore this becomes an `archived` flag plus `archivedBy/archivedAt`, with rules that keep hard delete to adults.
- **Program settings** (Coaches' Dashboard → gear tab; **program coaches only**: hidden for mentors, who use their team's Settings):
  - **Teams:** list (badge, FTC number, sprint length, student count, mentors or a "No mentor yet" warning) with Open →, Edit, Delete. **＋ New team**: name, FTC number (unique), sprint length (7/10/14/21 days; Sprint 1 starts today), color, plus a copy of the subteam defaults. Renaming carries through to goals (`renameTeamReferences`, also used by team Settings). Delete has a confirm row: tasks/events/Team Home go; people move to "No team"; students keep their goals. Circuit Breakers (the live team) can't be deleted.
  - No page subtitle or Teams note (removed as clutter).
  - **Subteam defaults** (`subteamDefaults`): add, edit, recolor (click the colored tag; no separate dot), delete. Copied into new teams only. Descriptions use sentence case.
  - **People:** everyone in the program, filterable by team ("No team" included) and searchable. Inline role and team selects, Remove (with a confirm row), ＋ Add person (Display name · Email on row 1, Role · Team on row 2; any valid email). The team field follows the role but uses one picker (`teamChecklist`, also in the People rows): radios with "No team" on top for students and leads (closes on pick), checkboxes with "All teams" on top for mentors, a fixed "All teams" for program coaches. Changing team takes the person off the old team's tasks and resets their subteams; goals follow the student. Program coaches show "All teams". You can't change your own role or remove yourself. The note is just "32 people · N without a team". People are grouped into collapsible sections (`collapsedPeopleGroups`): Program coaches, each team (mentors first; a multi-team mentor appears under each), then No team; search opens every group and the team filter shows one group. Role and team read as plain text until the row is hovered or focused, then show as dropdowns (`personRow`).
  - Data: every `orgTeams` entry has a `roster` (live team: `teamRoster`; sample teams get one built from their names, plus a sample mentor; Iron Owls has none). `team.members` is now a getter for student/lead names. `unassignedPeople` holds people without a team.
  - **Import CSV** (in People; moved here from team Settings): five columns Name · Email · Role · Subteams · Team (Team last and optional: name or FTC number, so a 4-column team file still works), header row optional, example + template download. A "Team for rows without one" picker defaults to the People filter's team. Only those columns are read; extras (e.g. phone) are dropped. Full last names are shortened to an initial. The preview marks rows ready or skipped (invalid email, already in the program, listed twice, unknown role or team). `openMemberImport({ program })`; the team mode is kept but unused.
  - **Mentors can be on several teams:** their team cell is a checklist with team-color dots and an **All teams** option at the top (ticks every current team; a team created later doesn't add them automatically). Changes apply when the menu closes. The same member object sits in each team's roster; `programPeople()` dedupes and `setMentorTeams()` joins/leaves (leaving takes them off that team's tasks). Changing a mentor to another role keeps only their first team. Mentors on 2+ teams get the ⌄ switcher.
- **Settings:**
  - Team name, FTC number, color, and icon (program coach / mentors only; the icon is resized to 128px).
  - Members (name, role, subteams; no emails shown; adding someone requires an email, any valid address).
  - Subteams (rename, recolor, delete with reassignment). Defaults (also the program's `subteamDefaults`): Mechanical (red; design, CAD, fabrication, maintenance), Software (green; tele-op, autonomous, wiring), Outreach (purple; Reach and Connect), Competition Ops (blue; pit, judge's interview, scouting, packing, logistics), Drive Team (teal; driving, strategy, alliance coordination).
- **Theming:** light blues are replaced by team-color shades (`--team-soft/softer/line/ink/wash`, computed in `applyTeamAccent()`). Links, the timeline's today line, and solid Save buttons stay blue.

## User preferences learned in this project

- Keep things **dense** for planning views (12px text, tight rows), and avoid repeated headers and unnecessary whitespace or placeholder text.
- Dates are chosen with a picker, never typed.
- No emails displayed in member lists.
- Don't use "Not yet" as a status label.
- When the user asks for UI tweaks, make them directly. Explain trade-offs only when a request conflicts with the brief's privacy rules.

## Testing approach used

Tests are ad-hoc scripts injected before `</body>` into a scratch copy of `index.html`. Each is run with headless Chrome (`--dump-dom`, results written into a `<pre id="results">`) under a `perl -e 'alarm N'` timeout, because headless Chrome sometimes hangs. These scripts are not in the repo. Before testing, extract the main `<script>` and run `node --check` on it; a syntax error stops every function from loading, and tests then fail in confusing ways ("selectTeam is not defined"). Many older ones assumed Program coach as the default role and now need `setDemoRole(...)` first.
“When testing in Chrome, always launch it headless with --no-first-run --no-default-browser-check.”
Those flags alone didn't stop the macOS prompt, so tests don't launch the installed Google Chrome at all: run `~/.cache/chrome-for-testing/headless-chrome.sh [--timeout=SECONDS] <chrome args>` (e.g. `--dump-dom file://…`, or `--screenshot=… --window-size=…`). It uses Chrome for Testing's `chrome-headless-shell` (headless-only, not registered as a browser) with those flags, a throwaway profile, and the hang timeout. If it's missing: `npx -y @puppeteer/browsers install chrome-headless-shell@stable --path ~/.cache/chrome-for-testing`.

## Open items / next steps

### In progress: page-by-page UI cleanup ("get rid of clutter")

The user is reviewing the app one page at a time. Follow this loop and **don't move to the next page until the user agrees to move on**:

1. Take a screenshot of the page with the headless wrapper (see Testing) and look at it.
2. Reply with a short, **numbered** list of clutter candidates. Each item says what it is, why it's clutter, and what you'd do. Mark anything you'd keep as such.
3. The user answers per number ("1 yes, 2 no, 4a yes…") and often adds requests mid-turn. Make only what they approved, plus their additions.
4. Run `node --check` on the main script (a missing comma once broke the whole page), run a headless test of the change, and look at a fresh screenshot.
5. Report what changed and anything you noticed or fixed along the way. Ask "Anything else on this page?" and name the next page.
6. Update CLAUDE.md as you go.

**Order and status** (preview role for team pages: Student, the default):
- Done: 1 Huddle · 2 Dashboard Tasks · 3 Dashboard Goals · 4 Program settings · Dashboard Announcements · 5 Team Home · 6 Planning (wrapping up; confirm before moving on).
- Next: 7 My Tasks · 8 Board · 9 List (apply the agreed column order: Name · Status · Due date · Assignee · Subteam · Type; semibold 13px names) · 10 Timeline · 11 Team Goals (coach/mentor view, then student) · 12 Team Settings · 13 Announcements (team view) · 14 student pop-ups (goal check-in, set a goal, date passed).

**Patterns the user has approved (apply them to later pages):**
- Whitespace separates groups; no extra rules or lines between them. Keep headers vertically centered between any lines that remain.
- No subtitles or eyebrows that restate the tab or page name.
- Don't show a chip for the default case ("All teams" on events, plan rows, and similar); show chips only for exceptions.
- Task, student, and goal names: semibold 13px, near-black.
- Hide repeated per-row controls until hover or focus (⠿ reorder handle, Move to, role and team dropdowns).
- Team-name chips use the team's own color; one team picker everywhere (`teamChecklist`): radios for one team, checkboxes plus All teams for several.
- Order is priority (no priority field). Sentence case for descriptions.
- The user often declines collapsing or truncating lists ("keep all sprints shown") and keeps things like the announcement banner as is. Offer these, but don't push.

### Other open items


- **Goals:** reminders for coaches (email/notification; needs the approved email method).
- **Data:** unify board and backlog data; then design the Firestore data model and security rules (the brief's suggested starting point). Assignees become arrays of UIDs (`array-contains` for "My tasks").
- **Not built yet:** 
  - drag-and-drop (planned for the React build; keep Move to and the tap menus for touch and keyboard), 
  - a Safari clear button for date fields.
