# Switchback

Team boards, sprints, and learning goals for student teams: robotics, design, engineering, clubs, and class projects.
Simple enough for middle schoolers, with planning tools for team leads and coaches, and built around student privacy.

> **Status:** early development. The full interface exists as a clickable mock-up (`mockup/index.html`: open it in
> Chrome); the production app is being built from it.

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
```

`npm start` runs everything locally against the Firebase emulators; no Firebase account is needed. The emulator UI is at
http://localhost:4000.

Other scripts: `npm run test:unit`, `npm run test:e2e`, `npm run lint`, `npm run type-check`, `npm run build`.

## Deploying for your organization

See [docs/configuration.md](docs/configuration.md): create a Firebase project (the free Spark plan is enough for ~100
people), choose how people sign in (Google Workspace domains, email/password, or both), describe your program in
`program.config.json`, and deploy.

## Docs

- [docs/configuration.md](docs/configuration.md): setting up a deployment.
- [docs/data-model.md](docs/data-model.md): Firestore collections, types, access rules, and queries.
- [CLAUDE.md](CLAUDE.md): the design notes behind the mock-up (features, decisions, preferences).

## License

[MIT](LICENSE)
