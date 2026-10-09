# Configuring a deployment

Each organization that runs this app (a school, a club, a community program) deploys its own copy to its own Firebase
project. Everything specific to that organization lives in two files that are **not** committed to the repo:

| File | What it holds | Made from |
|---|---|---|
| `program.config.json` | Program name, how people sign in, the first coach, the season, default subteams, starting teams | `program.config.example.json` |
| `.env.local` | The Firebase web app settings (API key, project ID, …) | `.env.example` (added with the app) |

> **Status:** the app is still being built. `npm run setup` works today; the step marked *(coming)* doesn't exist yet.

## `program.config.json`

```jsonc
{
  "program": {
    "id": "example-robotics",          // short id used in the database (letters, numbers, dashes)
    "name": "Example Robotics"         // shown in the app
  },
  "signIn": {                          // one or both methods
    "google": { "allowedDomains": ["example.edu"] },   // Workspace domain(s) people sign in with
    "password": { "roles": ["mentor", "coach"] }       // who may use email/password
  },
  "firstCoach": {                      // the first program coach; they add everyone else in the app
    "displayName": "Alex P.",          // first name + last initial
    "email": "coach@example.edu"
  },
  "season": { "id": "2026-27", "name": "2026–27", "start": "2026-09-01", "end": "2027-03-31" },
  "subteamDefaults": [                 // copied into each new team; teams can change their own later
    { "name": "Mechanical", "color": "red", "description": "Design, CAD, fabrication, and maintenance" }
  ],
  "teams": [                           // optional: teams to create now (more can be added in the app)
    { "name": "Circuit Breakers", "number": "418", "color": "green", "sprintDays": 14 }
  ]
}
```

### Choosing sign-in methods

Turn on one or both. The security rules enforce these choices, not just the sign-in screen.

- **`google`**: best for schools on Google Workspace. Accounts on `allowedDomains` sign in with Google, using the school
  accounts they already have; no passwords to manage.
- **`password`** (email and password): for people without an account on your domain, such as volunteer mentors and
  coaches, or whole programs without a shared Google domain (community teams, clubs). `roles` limits who may use it:
  `student`, `lead`, `mentor`, `coach`.

Common setups:

| Program | `signIn` |
|---|---|
| School; adults use school accounts too | `{ "google": { "allowedDomains": ["example.edu"] } }` |
| School; volunteer mentors and coaches from outside | `{ "google": { "allowedDomains": ["example.edu"] }, "password": { "roles": ["mentor", "coach"] } }` |
| Community team, no shared domain | `{ "password": { "roles": ["student", "lead", "mentor", "coach"] } }` |

How it plays out:

- **Each person's method follows from their email.** An email on one of `allowedDomains` must use Google (so nobody can
  make a separate password account with a school email). Any other email uses email/password, if `password` is on and
  allows that person's role. Otherwise the invite can't be added.
- **Email/password accounts must verify their email** before they can join (Firebase sends the link; free on Spark).
- **Students and passwords:** if `password` allows `student` or `lead`, **the organization is responsible for parental
  consent for students under 13** (COPPA in the US) and any local privacy rules. Keeping students on `google` avoids
  separate student passwords altogether.

Nobody can join without an invite: a coach (or a mentor, for their own teams) adds people by email, and the invite is
claimed the first time that person signs in. People with a password account choose their password the first time
("First time? Create a password" on the sign-in page), then click the link in the verification email.

Signing out clears the app's offline copy of the data from the browser, so a shared Chromebook doesn't keep the last
person's team data.

Colors: subteams use `red`, `green`, `yellow`, `blue`, `purple`, `teal`, `pink`, `gray`. Teams use a preset name
(`green`, `teal`, `blue`, `navy`, `purple`, `pink`, `red`, `orange`, `yellow`, `gray`) or any `#rrggbb` color.

## Setup steps

1. **Create a Firebase project** in the [Firebase console](https://console.firebase.google.com). The free **Spark** plan
   is enough for a program of ~100 people. Ideally, create it under your organization's own Google account.
2. **Turn on sign-in:** in Authentication → Sign-in method, enable **Google** and/or **Email/Password** to match
   `signIn`. Add your hosting domain under Authorized domains.
3. **Add a web app** in Project settings and copy its config into `.env.local`. Point this repo at your project with
   `npx firebase use --add`.
4. **Write `program.config.json`:** copy `program.config.example.json` and edit it. `npm run setup` checks it and lists
   anything that needs fixing.
5. **Create your program:** `npm run setup` (or `npm run setup -- --project <your-project-id>`). It creates the program,
   the season, subteam defaults, starting teams with their sprint calendars, and the first coach's invite.
   - It needs admin credentials once: run `gcloud auth application-default login`, or set
     `GOOGLE_APPLICATION_CREDENTIALS` to a service-account key file (keep it out of the repo; `.gitignore` covers
     `*service-account*.json`).
   - `--dry-run` shows what it would do without writing anything; `--emulator` tries it against the local emulators.
   - It also writes `public/signIn`: the program's name and sign-in methods, which the sign-in page reads before anyone
     has signed in (nothing personal).
   - Safe to re-run: it updates the program's name, sign-in settings, and subteam defaults, leaves existing teams
     alone, and invites the first coach only while the program has no coach.
6. **Deploy** *(coming)*: `npm run deploy` will publish the security rules, indexes, and the app to Firebase Hosting.
7. **Sign in as the first coach** and add mentors and students under Coaches' Dashboard → Settings → People (or import a
   CSV).

## Before real student data goes in

Check with your organization about: parental consent, whether Firebase is covered by your agreements (for schools, often
Google Workspace for Education terms), how long data is kept, how coaches and students may communicate, and which email
method the app may use for notifications. The app is designed for minimal data (display names, roles, teams, and what
people create), but the decisions belong to your organization.
