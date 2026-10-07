# Robotics Team Management App — mock-up

A UI mock-up for a custom web app to manage 7 FTC robotics teams (students ~13, some under 13) at Avenues. It replaces GitHub Projects, which is clunky for students; the school won't approve Asana, Monday, or Trello because of student data privacy. The current goal is to **finish the UI design before building the real app or connecting data**.

Everything lives in one self-contained file: `index.html` (HTML, CSS, and a classic `<script>`, plus one `<script type="module">` for the Tiptap editor). There is no build step: open the file in Chrome.

## Project brief (summary)

- **Planned stack:** web app (Chromebooks and phones), React or Svelte (undecided), Firebase Auth (Google sign-in with school accounts only), Firestore, Hosting, ideally under the school's Google account. About 100 daily users, so it should fit the free Spark plan; scope queries to the user's team. Cloud Functions would need the Blaze plan.
- **Features:** team boards (Trello-simple), coach dashboard across teams, student goal tracker with coach feedback, team home/wiki pages, announcements (in-app plus email), team chat (team channels only, no DMs), and PM features (subtasks, backlog, sprints, timeline).
- **Privacy (COPPA):**
  - Store only the auth UID, school email, display name, team, and user-created content.
  - Enforce access in Firestore security rules, not just the UI.
  - Students see only their own team's data and their own goals. Exception, decided below: teammates see goal *statement and status*.
  - No ads or trackers. No AI training on student data.
  - Design deletion and review in from the start.
  - Coach goal feedback must be visible to more than one coach (no private 1:1 adult–student channels).
  - Don't build features that invite students to type personal info.
- **Pending admin approval (no real student data until approved):** COPPA consent on parents' behalf, whether Firebase is covered by Workspace for Education, retention rules, Google Chat vs. built-in chat, the approved email method, coach–student communication policy, and the approval process for internal tools. **Add:** teammates seeing goal statements and status.
- **Design direction:** progressive disclosure (students get a simple view; sprints, backlog, and timeline are for leads and coaches). Trello's approachability, Linear's restraint, Asana's timeline and subtasks. Avoid Monday/ClickUp clutter.

## How the mock-up works

- **Demo roles:** use the profile button (top right, shows initials) → **Preview as**:
  - Student (Avery K.) — the default on load. Her Sprint 2 check-in is overdue, so the check-in pop-up appears on page load. Avery also has one paused goal.
  - Student · no goal yet (Mina L.) — shows the set-a-goal pop-up and setup.
  - Team lead (Jordan M.) — Jordan's goal date (End of Sprint 2) has passed, so the "date passed" pop-up appears.
  - Team mentor (Ms. Patel)
  - Program coach (Coach Rivera)
- **"Later" on goal pop-ups** is remembered for the browser tab's session (`sessionStorage`), so it won't reappear on refresh. Use a new tab to see it again.
- **Today's date** comes from the real clock (`todayIso()`). Sample data was written around Oct 6, 2026.
- **Circuit Breakers (FTC 418)** is the only "live" team with full task data. The other six teams (Gear Grinders, Bolt Brigade, Torque Titans, Servo Squad, Pixel Pilots, Iron Owls) have sample tasks, members, sprint calendars, and goals for the coach views. Switching to them in team mode shows Circuit Breakers' tasks, with a toast saying so.
- **Data model:** the board's task cards (DOM `dataset`) and the Backlog's task records (plain objects) are still **separate data sets**. This was deliberately deferred until the UI is final. Fields are shared (title, type, subteam, assignee, start, due, state/status, priority, detail). Assignees are stored as a `"|"`-joined string. Unifying these into one Firestore-shaped store is the next big step.
- **Tiptap** (v3.31.4) loads from esm.sh via `window.createRichEditor()` in the module script. It powers Team Home, announcement bodies, and task descriptions. In the real app, bundle it from npm; loading from a CDN means third-party requests, which conflicts with the no-trackers rule.

## What's built (by area)

- **Top bar:** team badge (an icon or a colored number block) plus the team name. Program coaches and team mentors get a ⌄ switcher: Coaches' Dashboard and their team(s). Also the Announcements button (with unread count) and the profile/preview menu.
- **Announcement banner** (on task tabs): lists *every* unread announcement, each with its own "Mark read". There is no "Mark all read" or "All announcements" link.
- **Team tabs:** Team Home · Planning · My Tasks · Board · List · Timeline · Goals · Settings (gear icon, right-aligned).
- **My Tasks:** the Board filtered to the signed-in user (assignee filter hidden, empty columns kept, ＋ Add task pre-assigns you).
- **Team Home:**
  - Tiptap notes with Edit / Cancel / Save floating at the top right of the notes area.
  - Events column: the real 2026–27 calendar.
    - Program-wide events are marked "All teams" and only program coaches can edit them.
    - Each team has one Nov/Dec and one Jan/Feb qualifier, picked by a name-seeded hash so they're stable across loads.
    - Super Qualifiers and the NYC Championship are marked "If qualified" and are skipped by the countdown.
    - The family social and open lab events were removed at the user's request.
  - ＋ Announcement button.
- **Sprint objectives** (Board / List / Timeline, under the sprint title): one line each (max 80 characters), subteam tags, met checkbox, competition countdown chip, collapsible. The sprint dropdown includes **All sprints**, which groups objectives by sprint.
- **Planning tab** (formerly "Backlog"; code still calls it `backlog`, and the unplanned pool section is still named Backlog):
  - Dense planning view: 12px text, ~29px rows.
  - One pinned column header at the top (no per-section headers); fixed column widths so sections line up.
  - Collapsible sprint sections, each with a collapsible Objectives panel (collapsed by default).
  - Click a sprint's dates to edit them.
  - **Move to ▾** button per row, and a Sprint field in the task panel.
- **Board:**
  - Columns tinted with the team color; each column scrolls on its own.
  - The board is exactly one screen tall, so when scrolled to the bottom the column titles sit under the top bar.
  - Cards show the subteam tag top-right; the priority dot was removed.
- **List / Backlog column order:** Name · Type · Subteam · Assignee · Due date · Status · Priority. The Backlog adds a Move to column. Subteam cells use the colored tags.
- **No done-circles anywhere** (circles mean select): tasks and subtasks are marked done by changing Status (task panel, Status column, a per-subtask status menu in the task panel, and inline in List/Backlog subtask rows). Exception: board card subtasks have a square checkbox to the right of the text (Done ↔ To do), since the board has no Status column; done subtasks get strikethrough.
- **Multi-select in list views** (List, Backlog, Coaches' Dashboard All tasks): the row circle **selects** the row and fills like a radio button. Shift-click selects a range; Esc or Clear deselects; switching tabs clears. A floating bulk bar appears at the bottom:
  - Backlog: Move to · Status · Priority · Assign (Move to clears the selection afterward).
  - List: Status · Priority · Assign.
  - Dashboard: Status · Priority only (teams have different rosters).
  - Assign adds a person to each task (or Unassign). There's no bulk Delete because there's no single-task delete yet.
  - Subtask rows in List and Backlog are selectable too and can be mixed with tasks (Status · Priority · Assign apply to both). Move to appears only when a task is selected; subtasks travel with their parent.
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
  - **Team mentor:** team-scoped adult. Dashboard limited to their team. Can't see comments written by other teams' coaches on a student's earlier goals.
  - **Program coach:** org-wide. Sees everything; can post program-wide announcements and events.
  - Anyone can post an announcement to their own team.
- **Coaches' Dashboard** (from the ⌄ menu; dark "All" badge):
  - **All tasks:** grouped by team; sprint filter (Previous / Current / Next / All Tasks), relative to each team's own sprints.
  - **Goals:** grouped by team, one row per active goal (student name on the first). Columns: Student · Goal · By · Status · Last check-in · Next check-in · Coach feedback · Attention. Filters, plus student detail with feedback tools.
- **Settings:**
  - Team name, FTC number, color, and icon (program coach / mentors only; the icon is resized to 128px).
  - Members (name, role, subteams; no emails shown; adding someone requires a school email).
  - Subteams (rename, recolor, delete with reassignment).
- **Theming:** light blues are replaced by team-color shades (`--team-soft/softer/line/ink/wash`, computed in `applyTeamAccent()`). Links, the timeline's today line, and solid Save buttons stay blue.

## User preferences learned in this project

- Keep things **dense** for planning views (12px text, tight rows), and avoid repeated headers and unnecessary whitespace or placeholder text.
- Dates are chosen with a picker, never typed.
- No emails displayed in member lists.
- Don't use "Not yet" as a status label.
- When the user asks for UI tweaks, make them directly. Explain trade-offs only when a request conflicts with the brief's privacy rules.

## Testing approach used

Tests are ad-hoc scripts injected before `</body>` into a scratch copy of `index.html`. Each is run with headless Chrome (`--dump-dom`, results written into a `<pre id="results">`) under a `perl -e 'alarm N'` timeout, because headless Chrome sometimes hangs. These scripts are not in the repo. Many older ones assumed Program coach as the default role and now need `setDemoRole(...)` first.

## Open items / next steps

- **Goals:** reminders for coaches (email/notification; needs the approved email method).
- **Data:** unify board and backlog data; then design the Firestore data model and security rules (the brief's suggested starting point). Assignees become arrays of UIDs (`array-contains` for "My tasks").
- **Not built yet:** team chat (or link to Google Chat spaces, pending approval), drag-and-drop (planned for the React build; keep Move to and the tap menus for touch and keyboard), task delete (single and bulk), a recurring-event option, and a Safari clear button for date fields.
- Confirm the Onshape spelling ("OnShape" was kept as the user wrote it in the goal ideas) and the qualifier dates against the official FIRST NYC schedule.
