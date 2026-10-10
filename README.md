# Switchback

Team boards, sprints, and learning goals for student teams: robotics, design, engineering, clubs, and class projects.
Simple enough for middle schoolers, with planning tools for team leads and coaches, and built around student privacy.

> **Status:** early development. Every page of the design (`mockup/index.html`, a clickable mock-up: open it in Chrome)
> now works in the app against the Firebase emulators. Next: polishing pages, and deploying to a real Firebase project.

## What it does

- **Team boards:** Board, List, Timeline, and My Tasks for the current sprint; Planning for leads and coaches (sprints,
  backlog, objectives).
- **Learning goals:** students set a goal, plan for obstacles, and check in each sprint; coaches give feedback.
  Teammates see only a goal's statement and status.
- **Team Home:** notes, events, and announcements.
- **Coaches' Dashboard:** every team's tasks and goals, a daily huddle for coaches and mentors, and program settings
  (teams, people, seasons).

## Privacy by design

Built for students, including those under 13:

- Stores only display names (first name + last initial), roles, teams, and what people create. Member lists never show
  emails.
- Access is enforced by Firestore security rules, not just the interface: students see only their own team's data and
  their own goals.
- No ads, trackers, or third-party scripts. Coach feedback is visible to every coach of the team (no private 1:1 adult
  channels).
- Each organization runs its own copy in its own Firebase project and decides its own data policies.

## Quick start (local development)

Needs Node.js 22.18+ or 24.12+, and Java 21+ (for the Firebase emulators).

```sh
npm install
npm start            # Firebase emulators + the app at http://localhost:5173
npm run seed:demo    # in another terminal: load the sample program (7 teams, people, tasks, goals)
```

`npm start` runs everything locally against the Firebase emulators; no Firebase account is needed. The emulator UI is at
http://localhost:4000. `seed:demo` replaces whatever is in the emulators with "Example Robotics" and prints the sample
accounts you can sign in as.

Tests: `npm run test:unit`, `npm run test:rules` (security rules; starts its own emulator, or `npm run test:rules:live`
while `npm start` is running), `npm run test:e2e` (needs `npm start` and `npm run seed:demo`). CI runs all of them on
every pull request. Other scripts: `npm run lint`, `npm run type-check`, `npm run build`.

Want to help? See [CONTRIBUTING.md](CONTRIBUTING.md).

## Deploying for your organization

See [docs/configuration.md](docs/configuration.md): create a Firebase project (the free Spark plan is enough for ~100
people), choose how people sign in (Google Workspace domains, email/password, or both), describe your program in
`program.config.json`, and deploy.

## Docs

- [docs/configuration.md](docs/configuration.md): setting up a deployment.
- [docs/email.md](docs/email.md): optional email for announcements and huddles (a Google Apps Script you install).
- [docs/data-model.md](docs/data-model.md): Firestore collections, types, access rules, and queries.
- [CONTRIBUTING.md](CONTRIBUTING.md): ground rules, setup, and checks for contributors.
- [CLAUDE.md](CLAUDE.md): the design notes behind the mock-up (features, decisions, preferences).

## License

[MIT](LICENSE)
