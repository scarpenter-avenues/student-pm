# A tour of the code

This is for anyone opening the code for the first time, especially students. It explains how the app is put
together, where each kind of thing lives, and how to follow one feature from the screen to the database.

You don't need to understand all of it to change something. Read the first two sections, then jump to the part you're
curious about.

## The big picture

Switchback is a web page that runs entirely in your browser. There is no server of ours in the middle.

```
  your browser                                  Google's servers (Firebase)
┌─────────────────────────────┐              ┌──────────────────────────────┐
│  the app (Vue + TypeScript) │  reads and   │  Authentication: who you are │
│                             │  writes      │                              │
│  screens → shared logic →   │ ───────────► │  Firestore: the database     │
│  the data layer             │ ◄─────────── │    + the security rules      │
└─────────────────────────────┘  live updates└──────────────────────────────┘
```

Three ideas explain most of the code:

1. **The database decides who can do what.** Because the browser talks to the database directly, the app can't be
   trusted to enforce privacy: anyone could change the code running in their own browser. So the rules live in
   [`firestore.rules`](../firestore.rules), on Google's side. The app hiding a button is a courtesy; the rules are the
   lock.
2. **The screen follows the data, live.** The app doesn't fetch a page of tasks and then remember them. It
   _subscribes_: it asks the database "tell me these tasks, and tell me again whenever they change". When a teammate
   moves a card, your board updates on its own.
3. **Logic is kept apart from screens.** Anything that can be worked out without a screen or a database (when is a
   check-in due? what's the new order after a drag?) is a plain function in `src/model/`, with tests.

## Where things live

```
src/
  main.ts            starts the app
  App.vue            the outermost component: the sign-in screen, or the app
  firebase.ts        the one place that connects to Firebase
  model/             plain logic and the shapes of the data. No screen, no database. Start here.
  data/              the only code that reads or writes the database
  stores/            state shared by the whole app (who's signed in, which task panel is open)
  composables/       reusable pieces of screen logic ("this team's tasks", "what's selected")
  router/            which address shows which page, and who's allowed to see it
  ui/                small helpers for the screen: dates as text, team colors, drag and drop
  components/        the building blocks of pages (a task card, a calendar, the goal wizard)
  views/             the pages themselves, one per tab
  styles/            styles shared across pages

firestore.rules      who can read and write what
scripts/             programs you run from a terminal: set up a program, load the demo, send email
tests/rules/         tests that try to break the security rules
e2e/                 tests that click through the real app in a browser
docs/                guides like this one
```

A few words you'll see everywhere:

| Word                      | What it means here                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **component**             | A piece of the screen with its own look and behavior, in a `.vue` file. A page is components inside components.                                                                |
| **`ref` / `computed`**    | Vue's way of holding a value the screen depends on. Change a `ref` and everything showing it updates. A `computed` is a value worked out from others, kept up to date for you. |
| **composable**            | A function named `useSomething` that packages up some `ref`s and the logic around them, so several components can share it.                                                    |
| **store**                 | A composable with one shared copy for the whole app (made with Pinia).                                                                                                         |
| **document / collection** | Firestore's words. A document is one record (one task); a collection is a list of them (a team's tasks).                                                                       |
| **program**               | One organization's copy of the data: its teams, people, and seasons.                                                                                                           |

## Inside a `.vue` file

Every component has up to three parts:

```vue
<script setup lang="ts">
// 1. The logic: what data it holds, and what happens when you click things.
</script>

<template>
  <!-- 2. The HTML it draws, with {{ values }} filled in and @click="handlers". -->
</template>

<style scoped>
/* 3. Its styles. "scoped" means they apply only to this component. */
</style>
```

Each file starts with a comment saying what the component is for. Read that first.

## Follow one feature: dragging a card to "Done"

This touches every layer, so it's a good one to trace.

1. **The page.** [`src/views/team/BoardView.vue`](../src/views/team/BoardView.vue) draws three columns. Each column's
   list has `v-drag-sort`, which makes its cards draggable.
2. **The drag.** [`src/ui/dragSort.ts`](../src/ui/dragSort.ts) handles the dragging itself. When you let go, it
   doesn't move anything. It reports what happened: _this task, dropped in this column, between these two cards_.
3. **The decision.** `BoardView` passes that to `drop()` in
   [`src/composables/useTaskEdits.ts`](../src/composables/useTaskEdits.ts), which works out two changes: the new
   status ("Done"), and a new _rank_, a sort key that falls between the two neighbors
   ([`src/model/rank.ts`](../src/model/rank.ts)).
4. **The write.** `drop()` calls `updateTask()` in [`src/data/writes.ts`](../src/data/writes.ts), which sends the
   change to Firestore.
5. **The lock.** Firestore checks [`firestore.rules`](../firestore.rules): is this person on this team? If not, the
   write is refused, whatever the app thought.
6. **The update.** The board was already subscribed to this team's tasks
   ([`src/composables/useTeamData.ts`](../src/composables/useTeamData.ts), through `useLiveQuery` in
   [`src/data/live.ts`](../src/data/live.ts)). The changed task arrives, the list re-sorts, and Vue redraws the
   columns. Your teammates' boards do the same.

Notice what _didn't_ happen: nothing moved the card on screen by hand. The data changed, and the screen followed.

## The folders, one by one

### `src/model/`: the rules of the app, as plain functions

No Vue, no Firebase, and every file has tests in `__tests__/`. This is the easiest code to read and the best place
to start.

| File                                           | What's in it                                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                                     | The shape of every kind of record: `Task`, `Team`, `Goal`, and so on. Read this to learn what the app stores.               |
| `dates.ts`                                     | Dates are plain `"2026-10-11"` text; these helpers add days and count between them.                                         |
| `sprints.ts`                                   | Builds a season's sprints, and shifts them when one changes length.                                                         |
| `rank.ts`                                      | How tasks stay in order. Each has a sort key, and moving one only changes its own key.                                      |
| `subtasks.ts`                                  | Adding, changing, and reordering the steps inside a task.                                                                   |
| `goals.ts`                                     | The goal wizard's questions, when a check-in is due, and what a coach should be told.                                       |
| `huddles.ts`, `csv.ts`, `signIn.ts`, `slug.ts` | The huddle's default plan, reading a spreadsheet of people, which sign-in method an email uses, and turning names into ids. |

### `src/data/`: talking to the database

Nothing outside this folder calls Firestore. That's deliberate: there's one place to look when asking "how is this
read?" or "what gets written?".

| File           | What's in it                                                              |
| -------------- | ------------------------------------------------------------------------- |
| `refs.ts`      | The address of every collection, typed, so a task ref gives you a `Task`. |
| `queries.ts`   | Every question the app asks, such as "this team's tasks in this sprint".  |
| `writes.ts`    | Every change the app makes, such as `addTask` and `postAnnouncement`.     |
| `admin.ts`     | Bigger changes only a program coach makes, like starting a new season.    |
| `live.ts`      | `useLiveQuery`: subscribes to a query and keeps a `ref` up to date.       |
| `converter.ts` | Adds each record's id when reading it.                                    |
| `index.ts`     | Hands the rest of the app ready-made `refs`, `queries`, and `writes`.     |

### `src/stores/` and `src/composables/`: shared screen logic

- `stores/session.ts` is the heart of sign-in: who you are, your program, your teams. Most things read from it.
- `composables/useTeamData.ts` gathers everything about the team you're looking at (its sprints, tasks, and people)
  so each page doesn't have to.
- `composables/useTaskView.ts` applies the sprint picker and filters; `useTaskEdits.ts` makes changes to tasks;
  `useSelection.ts` tracks which rows are ticked; `useGoals.ts` loads goals and works out what needs attention.
- `composables/usePopover.ts` and `useMenu.ts` position and close the floating menus.

### `src/router/`: pages and permissions

`index.ts` lists the addresses. `access.ts` has one function, `decide()`, that answers "may this person open this
page, and if not, where should they go?". It's a plain function with tests, which is why it lives apart from the
router itself.

### `src/components/` and `src/views/`: the screen

A view is a whole page; a component is a part of one.

- `components/ui/` holds the general-purpose controls: menus, the calendar, the people picker, the rich text editor.
  You can see them all on one page at `http://localhost:5173/dev/components` while the app is running.
- `components/tasks/`, `goals/`, `huddle/`, `settings/`, `program/` hold the parts of those features.
- `components/AppShell.vue` and `TopBar.vue` are the frame around every page; `TaskPanel.vue` is the side panel that
  opens when you click a task.
- `views/team/` has one file per team tab, and `views/dashboard/` one per Coaches' Dashboard tab.

### `firestore.rules` and `tests/rules/`

The rules read like a list of permissions: for each kind of record, who may read it, create it, change it, or delete
it. They're short and worth reading.

The tests in `tests/rules/` sign in as each kind of person (a student, a lead, a mentor, a coach, a stranger) and
_try things that should fail_. If you change who can do something, you change a rule and its test together.

### `scripts/`

Programs for the terminal, not part of the web page.

- `setup.ts` creates a real program from `program.config.json`.
- `seed-demo.ts` and `demo/data.ts` load the sample program you see when trying the app locally.
- `email/` and `github/` are the two optional background jobs. They're written here in TypeScript so they can be
  tested, then bundled into one file that runs in Google Apps Script. See [email.md](email.md) and
  [github.md](github.md).

## Good first things to try

1. **Read a model file and its tests side by side.** Open `src/model/rank.ts` and `src/model/__tests__/rank.spec.ts`.
   The tests show what each function is for.
2. **Change some words.** The goal wizard's questions are in `src/model/goals.ts`. Change one, save, and watch the
   page update.
3. **Break a rule on purpose.** In `firestore.rules`, loosen one permission, then run `npm run test:rules` and see
   which test catches it. Put it back afterward.
4. **Add a field to a card.** Follow the trail from `Task` in `src/model/types.ts` to
   `src/components/tasks/TaskCard.vue`.

## Running the checks

```sh
npm run test:unit      # the plain-logic tests (fast)
npm run test:rules     # the security rules, against a local database
npm run test:e2e       # a real browser clicking through the app (needs npm start and npm run seed:demo)
npm run type-check     # TypeScript: do all the pieces fit together?
npm run lint           # common mistakes and style
```

[CONTRIBUTING.md](../CONTRIBUTING.md) explains what to run before opening a pull request.

## A note on the comments

Files start with a comment that says what they're for, and functions that aren't obvious say why they exist or what
they return. If a comment and the code disagree, the code is what runs, and the comment is a bug worth fixing.
