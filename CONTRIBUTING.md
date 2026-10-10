# Contributing to Switchback

Thanks for helping. Switchback is used by student teams, including kids under 13, so a few rules come first. They're
short.

## The ground rules

1. **Privacy comes first.** Store only what the app needs: display names (first name and last initial), roles, teams,
   and what people create. Don't add fields or features that invite students to type personal details (birthdays,
   phone numbers, addresses, health or family information). Member lists never show emails.
2. **Access is enforced by the security rules, not the interface.** If a change affects who can read or write
   something, it must change `firestore.rules`, add or update a test in `tests/rules/`, and update the access table in
   `docs/data-model.md`. Every `update` rule checks the document both before and after the change, as strictly as
   `create`.
3. **No third-party requests.** No ads, analytics, trackers, CDNs, or remote fonts. Bundle dependencies from npm.
4. **No real people or schools.** Code, docs, sample data, and screenshots use made-up names ("Example Robotics",
   `example.edu`). Each organization describes itself in its own `program.config.json`, which is never committed.
5. **Adults talk to students in the open.** Coach feedback is visible to every coach of the team; don't add private
   one-to-one channels between adults and students.

## Getting set up

You need Node.js 22.18+ or 24.12+, and Java 21+ (for the Firebase emulators). No Firebase account is needed.

```sh
npm install
npm start            # Firebase emulators + the app at http://localhost:5173
npm run seed:demo    # in another terminal: load the sample program and print the sample accounts
```

Sign in with Google as any sample person (pick them in the emulator's pop-up), e.g. `avery.k@example.edu` (student),
`jordan.m@example.edu` (team lead), `ms.patel@example.edu` (mentor), or `coach.rivera@example.edu` (program coach). The
emulator UI at http://localhost:4000 shows the data.

## Where things are

| Path | What |
|---|---|
| `src/` | The app (Vue 3, TypeScript, Pinia, Vue Router) |
| `src/model/` | Pure logic and types (dates, sprints, goals, ranks, CSV). Unit-tested; no Firebase. |
| `src/data/` | The only code that reads or writes Firestore: typed refs, queries, writes, live listeners |
| `src/components/ui/` | Shared controls (menus, calendar, pickers, chips, rich text). Try them at `/dev/components`. |
| `firestore.rules`, `tests/rules/` | Security rules and their tests |
| `e2e/` | Browser tests (Playwright) |
| `scripts/` | `npm run setup` (a real deployment) and `npm run seed:demo` (the emulators) |
| `mockup/index.html` | The original clickable design. The reference for how things should look and behave. |
| `docs/` | Deploying (`configuration.md`) and the data model (`data-model.md`) |

## Before you open a pull request

Run what CI runs:

```sh
npx prettier --check src e2e tests scripts   # or npm run format to fix
npm run lint
npm run type-check
npm run test:unit -- --run
npm run test:rules        # starts its own emulator (use test:rules:live while npm start is running)
npm run test:e2e          # needs npm start and npm run seed:demo
```

CI runs all of these on every pull request, using the emulators. It needs no secrets.

## Writing code

- Match the code around you: its naming, comment density, and patterns.
- Read and write Firestore only through `src/data/`. A new query goes in `queries.ts`, with a case in
  `tests/rules/queries.test.ts` for each role that runs it, and an index in `firestore.indexes.json` if it needs one
  (the emulator doesn't check indexes).
- Put logic that doesn't need the screen or the database in `src/model/`, with unit tests.
- Never render stored HTML with `v-html`; use `RichText.vue`.
- Dates without a time are `"YYYY-MM-DD"` strings (see `src/model/dates.ts`). People pick dates from the calendar;
  they never type them.
- Use the themed controls in `src/components/ui/` instead of native selects and date inputs.

## Writing words

The app speaks to students. Use plain, short sentences and sentence case. Say what happened and what to do next ("That
email and password don't match."), not error codes. Don't use "Not yet" as a status: in many schools it's the lowest
grade.

## Pull requests

- Keep them small and focused, and say what changed and why.
- Add a screenshot for anything visible.
- Note any change to the security rules or the data model at the top of the description.

## Reporting a security or privacy problem

Please don't open a public issue. Use GitHub's private vulnerability reporting (the repository's Security tab →
"Report a vulnerability").

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
