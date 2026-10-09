// The mock-up's sample program (mockup/index.html), as Firestore documents. Used by `npm run seed:demo`.
// Circuit Breakers has the full, fixed sample data; the other teams' tasks and goals are placed relative to today.
import { Timestamp } from 'firebase-admin/firestore'
import { generateNKeysBetween } from 'fractional-indexing'
import { goalStatement, type Role, type Status, type TaskType } from '../../src/model/types'
import { buildSprints, sprintIndexOn, type SprintDates } from '../../src/model/sprints'
import { daysBetween, shiftIsoDate, toUtcDate } from '../../src/model/dates'

export const DEMO_PROGRAM_ID = 'example-robotics'
export const DEMO_PASSWORD = 'switchback-demo'
const SEASON = { id: '2026-27', name: '2026–27', start: '2026-09-01', end: '2027-03-31' }
const LAST_SEASON = { id: '2025-26', name: '2025–26', start: '2025-09-01', end: '2026-03-31' }

export type Doc = [path: string, data: Record<string, unknown>]
export interface DemoUser {
  uid: string
  email: string
  displayName: string
  provider: 'google.com' | 'password'
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const at = (iso: string, hour = 9) =>
  Timestamp.fromDate(new Date(`${iso}T${String(hour).padStart(2, '0')}:00:00Z`))
const P = `programs/${DEMO_PROGRAM_ID}`

const SUBTEAMS = [
  {
    id: 'mechanical',
    name: 'Mechanical',
    color: 'red',
    description: 'Design, CAD, fabrication, and maintenance',
  },
  {
    id: 'software',
    name: 'Software',
    color: 'green',
    description: 'Tele-op, autonomous, and wiring',
  },
  {
    id: 'outreach',
    name: 'Outreach',
    color: 'purple',
    description: 'Planning and coordination for Reach and Connect',
  },
  {
    id: 'competition-ops',
    name: 'Competition Ops',
    color: 'blue',
    description: "Pit, judges' interview, scouting, packing, and logistics",
  },
  {
    id: 'drive-team',
    name: 'Drive Team',
    color: 'teal',
    description: 'Driving, strategy, and alliance coordination',
  },
]
const subteamId = (name: string) => SUBTEAMS.find((s) => s.name === name)?.id ?? slug(name)

interface DemoTeam {
  name: string
  number: string
  color: string
  start: string
  sprintDays: number
  mentor?: { name: string; email?: string; provider?: 'password' }
  students: string[]
}
// Circuit Breakers keeps the mock-up's exact sprint calendar (15-day sprints from Sep 2); see CB_SPRINTS below.
const TEAMS: DemoTeam[] = [
  {
    name: 'Circuit Breakers',
    number: '418',
    color: 'green',
    start: '2026-09-02',
    sprintDays: 15,
    mentor: { name: 'Ms. Patel' },
    students: ['Jordan M.', 'Avery K.', 'Sam R.', 'Mina L.'],
  },
  // Mr. Okafor is an outside volunteer: he signs in with email and password (allowed for mentors and coaches).
  {
    name: 'Gear Grinders',
    number: '7731',
    color: 'orange',
    start: '2026-09-07',
    sprintDays: 14,
    mentor: { name: 'Mr. Okafor', email: 'okafor.volunteer@gmail.com', provider: 'password' },
    students: ['Priya S.', 'Leo W.', 'Hana T.', 'Marcus D.'],
  },
  {
    name: 'Bolt Brigade',
    number: '12054',
    color: 'blue',
    start: '2026-09-14',
    sprintDays: 10,
    mentor: { name: 'Ms. Chen' },
    students: ['Ava P.', 'Noah B.', 'Zoe K.'],
  },
  {
    name: 'Torque Titans',
    number: '16620',
    color: 'purple',
    start: '2026-09-01',
    sprintDays: 21,
    mentor: { name: 'Mr. Alvarez' },
    students: ['Eli R.', 'Maya C.', 'Owen J.', 'Ruby F.'],
  },
  {
    name: 'Servo Squad',
    number: '21189',
    color: 'teal',
    start: '2026-09-10',
    sprintDays: 14,
    mentor: { name: 'Ms. Novak' },
    students: ['Ines G.', 'Theo M.', 'Kai L.'],
  },
  {
    name: 'Pixel Pilots',
    number: '23345',
    color: 'pink',
    start: '2026-09-03',
    sprintDays: 14,
    mentor: { name: 'Mr. Haddad' },
    students: ['Lena V.', 'Sami H.', 'Jonah E.', 'Ivy N.'],
  },
  // New this season, and still without a mentor (shows the "No mentor yet" warning).
  {
    name: 'Iron Owls',
    number: '9087',
    color: 'navy',
    start: '2026-09-16',
    sprintDays: 7,
    students: ['Dev A.', 'Clara S.', 'Finn O.'],
  },
]

const CB_SPRINTS: (SprintDates & { objectives?: [string, string[], boolean][] })[] = [
  ['2026-09-02', '2026-09-16'],
  ['2026-09-17', '2026-10-01'],
  ['2026-10-02', '2026-10-17'],
  ['2026-10-18', '2026-11-01'],
  ['2026-11-02', '2026-11-16'],
  ['2026-11-17', '2026-12-01'],
  ['2026-12-02', '2026-12-16'],
  ['2026-12-17', '2026-12-31'],
  ['2027-01-01', '2027-01-15'],
  ['2027-01-16', '2027-01-30'],
  ['2027-01-31', '2027-02-14'],
  ['2027-02-15', '2027-03-01'],
  ['2027-03-02', '2027-03-16'],
  ['2027-03-17', '2027-03-31'],
].map(([start, end], index) => ({ index, name: `Sprint ${index + 1}`, start: start!, end: end! }))
CB_SPRINTS[1]!.objectives = [
  ['First intake prototype built and tested', ['Mechanical'], true],
  ['Drivetrain drives straight in tele-op', ['Software', 'Drive Team'], false],
]
CB_SPRINTS[2]!.objectives = [
  ['Intake picks up a sample in 3 of 3 tries', ['Mechanical'], false],
  ['Arm moves to all 3 preset positions from code', ['Software', 'Mechanical'], false],
  ['Engineering notebook updated after every build night', [], true],
]
CB_SPRINTS[3]!.objectives = [
  ['Robot completes a full practice match without a reset', ['Drive Team'], false],
  ['Engineering portfolio draft ready for our first qualifier', [], false],
]

const sprintId = (index: number) => `${SEASON.id}-s${index + 1}`

export function buildDemo(today: string): { docs: Doc[]; users: DemoUser[] } {
  const docs: Doc[] = []
  const users: DemoUser[] = []
  const add = (path: string, data: Record<string, unknown>) => docs.push([path, data])
  // "Today" for the sample: inside the season, so there's always a current sprint.
  const reference = today < SEASON.start ? '2026-10-08' : today > SEASON.end ? SEASON.end : today

  // ---------- program, seasons, events ----------
  const auth = { google: { domains: ['example.edu'] }, password: { roles: ['mentor', 'coach'] } }
  add(P, { name: 'Example Robotics', auth, subteamDefaults: SUBTEAMS, currentSeasonId: SEASON.id })
  add(`${P}/public/signIn`, { name: 'Example Robotics', auth })
  add(`${P}/seasons/${SEASON.id}`, { name: SEASON.name, start: SEASON.start, end: SEASON.end })
  add(`${P}/seasons/${LAST_SEASON.id}`, {
    name: LAST_SEASON.name,
    start: LAST_SEASON.start,
    end: LAST_SEASON.end,
  })
  const programEvents: [string, string, string, string, 'Competition' | 'Work session', boolean][] =
    [
      [
        'Saturday Practice Session',
        '2026-10-17',
        '9am–3pm',
        'School robotics lab',
        'Work session',
        false,
      ],
      [
        'Saturday Build Session + Halloween Party',
        '2026-10-31',
        '9am–3pm',
        'School robotics lab',
        'Work session',
        false,
      ],
      [
        'Saturday Practice Session',
        '2026-11-14',
        '9am–3pm',
        'School robotics lab',
        'Work session',
        false,
      ],
      [
        'Parent Conference Day · Robotics shop open',
        '2026-11-23',
        '9am–4pm',
        'School robotics lab',
        'Work session',
        false,
      ],
      [
        'Parent Conference Day · Robotics shop open',
        '2026-11-24',
        '9am–4pm',
        'School robotics lab',
        'Work session',
        false,
      ],
      ['Super Qualifier 1', '2027-02-20', '8am–6pm', 'Host school', 'Competition', true],
      ['Super Qualifier 2', '2027-02-21', '8am–6pm', 'Host school', 'Competition', true],
      ['Regional Championship', '2027-03-07', '8am–6pm', 'Host school', 'Competition', true],
    ]
  programEvents.forEach(([title, date, time, location, type, conditional], i) =>
    add(`${P}/events/program-${i + 1}`, { title, date, time, location, type, conditional }),
  )
  const fallQualifiers = [
    ['Qualifier 2', '2026-11-08'],
    ['Qualifier 3', '2026-12-05'],
    ['Qualifier 4', '2026-12-06'],
  ] as const
  const winterQualifiers = [
    ['Qualifier 8', '2027-01-16'],
    ['Qualifier 9', '2027-01-17'],
    ['Qualifier 10', '2027-01-30'],
    ['Qualifier 11', '2027-01-31'],
  ] as const

  // ---------- people ----------
  const member = (
    name: string,
    role: Role,
    teamIds: string[],
    subteams: Record<string, string[]> = {},
    email?: string,
    provider: DemoUser['provider'] = 'google.com',
  ) => {
    const uid = slug(name)
    const address = email ?? `${uid.replace(/-/g, '.')}@example.edu`
    add(`${P}/members/${uid}`, {
      displayName: name,
      role,
      teamIds,
      subteams,
      joinedAt: at('2026-08-25'),
    })
    add(`${P}/members/${uid}/private/contact`, { email: address })
    users.push({ uid, email: address, displayName: name, provider })
    return uid
  }
  const coach = member('Coach Rivera', 'coach', [])
  const cbSubteams: Record<string, string[]> = {
    'Jordan M.': ['Mechanical', 'Competition Ops'],
    'Avery K.': ['Mechanical', 'Software'],
    'Sam R.': ['Software', 'Drive Team'],
    'Mina L.': ['Mechanical', 'Outreach'],
  }

  // ---------- teams ----------
  const roster: Record<string, string[]> = {}
  const teamSprints: Record<string, SprintDates[]> = {}
  TEAMS.forEach((team, teamIndex) => {
    const teamId = slug(team.name)
    add(`${P}/teams/${teamId}`, {
      name: team.name,
      number: team.number,
      color: team.color,
      sprintDays: team.sprintDays,
      seasonIds: team.name === 'Iron Owls' ? [SEASON.id] : [LAST_SEASON.id, SEASON.id],
      subteams: SUBTEAMS,
      github: {
        repo: `example-robotics/${teamId}-${team.number}`,
        importIssues: true,
        closeOnDone: true,
      },
      createdAt: at('2025-08-20'),
    })
    if (team.mentor)
      member(team.mentor.name, 'mentor', [teamId], {}, team.mentor.email, team.mentor.provider)
    roster[teamId] = team.students.map((name, i) =>
      member(
        name,
        teamId === 'circuit-breakers' && i === 0 ? 'lead' : 'student',
        [teamId],
        cbSubteams[name] ? { [teamId]: cbSubteams[name]!.map(subteamId) } : {},
      ),
    )
    const sprints =
      teamId === 'circuit-breakers'
        ? CB_SPRINTS
        : buildSprints(team.start, SEASON.end, team.sprintDays)
    teamSprints[teamId] = sprints
    sprints.forEach((sprint) => {
      const objectives = ((sprint as (typeof CB_SPRINTS)[number]).objectives ?? []).map(
        ([text, subteamNames, met], i) => ({
          id: `o${i + 1}`,
          text,
          subteamIds: subteamNames.map(subteamId),
          met,
        }),
      )
      add(`${P}/teams/${teamId}/sprints/${sprintId(sprint.index)}`, {
        seasonId: SEASON.id,
        ...sprint,
        objectives,
      })
    })
    const [fallName, fallDate] = fallQualifiers[teamIndex % fallQualifiers.length]!
    const [winterName, winterDate] = winterQualifiers[teamIndex % winterQualifiers.length]!
    add(`${P}/teams/${teamId}/events/fall-qualifier`, {
      title: fallName,
      date: fallDate,
      time: '8am–6pm',
      location: 'Host school',
      type: 'Competition',
      conditional: false,
    })
    add(`${P}/teams/${teamId}/events/winter-qualifier`, {
      title: winterName,
      date: winterDate,
      time: '8am–6pm',
      location: 'Host school',
      type: 'Competition',
      conditional: false,
    })
  })
  // A team from last season that wasn't carried over (Program settings → Teams → "Not in this season").
  add(`${P}/teams/rust-buckets`, {
    name: 'Rust Buckets',
    number: '5512',
    color: 'gray',
    sprintDays: 14,
    seasonIds: [LAST_SEASON.id],
    subteams: SUBTEAMS,
    github: { repo: null, importIssues: true, closeOnDone: true },
    createdAt: at('2025-08-20'),
  })
  const uidOf = (name: string) => slug(name)

  // ---------- tasks ----------
  type DemoTask = {
    title: string
    status: Status
    type?: TaskType
    subteams?: string[]
    assignees?: string[]
    start?: string
    due?: string
    detail?: string
    subtasks?: [string, Status, string[], string?, string?][]
    goalId?: string
    github?: number
    archived?: boolean
  }
  const taskDoc = (
    teamId: string,
    sprint: number | null,
    rank: string,
    task: DemoTask,
    createdBy: string,
  ) => ({
    title: task.title,
    type: task.type ?? 'Task',
    status: task.status,
    sprintId: sprint === null ? null : sprintId(sprint),
    rank,
    subteamIds: (task.subteams ?? []).map(subteamId),
    assigneeIds: (task.assignees ?? []).map(uidOf),
    start: task.start ?? null,
    due: task.due ?? null,
    descriptionHtml: task.detail ? `<p>${task.detail}</p>` : '',
    subtasks: (task.subtasks ?? []).map(([title, status, assignees, start, due], i) => ({
      id: `st${i + 1}`,
      title,
      status,
      assigneeIds: assignees.map(uidOf),
      start: start ?? null,
      due: due ?? null,
      subteamIds: (task.subteams ?? []).map(subteamId),
      type: 'Task',
      descriptionHtml: '',
      archived: null,
    })),
    goalId: task.goalId ?? null,
    github: task.github
      ? {
          repo: `example-robotics/${teamId}-418`,
          number: task.github,
          url: `https://github.com/example-robotics/${teamId}-418/issues/${task.github}`,
          state: 'open',
        }
      : null,
    archived: null,
    createdBy,
    createdAt: at('2026-09-02'),
    updatedAt: at('2026-10-06'),
  })
  const addTasks = (
    teamId: string,
    sprint: number | null,
    tasks: DemoTask[],
    createdBy: string,
  ) => {
    const ranks = generateNKeysBetween(null, null, tasks.length)
    tasks.forEach((task, i) =>
      add(
        `${P}/teams/${teamId}/tasks/${slug(task.title)}`,
        taskDoc(teamId, sprint, ranks[i]!, task, createdBy),
      ),
    )
  }
  const cb = 'circuit-breakers'
  addTasks(
    cb,
    null,
    [
      { title: 'Document drivetrain options', status: 'To do', subteams: ['Mechanical'] },
      {
        title: 'Compare sensor mounts',
        status: 'In progress',
        subteams: ['Mechanical'],
        assignees: ['Avery K.'],
      },
      {
        title: 'Research alternate wheels',
        status: 'To do',
        type: 'Learning',
        subteams: ['Mechanical'],
      },
      {
        title: 'Auto drifts left after the third sample',
        status: 'To do',
        type: 'GitHub issue',
        subteams: ['Software'],
        github: 17,
      },
    ],
    uidOf('Jordan M.'),
  )
  addTasks(
    cb,
    0,
    [
      {
        title: 'Build season kickoff',
        status: 'Done',
        subteams: ['Competition Ops'],
        assignees: ['Jordan M.'],
        due: '2026-09-08',
      },
      {
        title: 'Review game manual',
        status: 'Done',
        type: 'Learning',
        subteams: ['Drive Team'],
        assignees: ['Sam R.'],
        due: '2026-09-10',
      },
    ],
    uidOf('Jordan M.'),
  )
  addTasks(
    cb,
    1,
    [
      {
        title: 'Field measurements',
        status: 'Done',
        subteams: ['Mechanical'],
        assignees: ['Mina L.'],
        due: '2026-09-22',
      },
      {
        title: 'Prototype intake shape',
        status: 'In progress',
        subteams: ['Mechanical'],
        assignees: ['Avery K.'],
        due: '2026-09-24',
      },
      // Evidence for Avery's overdue Sprint 2 check-in: a finished Learning task from her goal.
      {
        title: 'Finish Onshape tutorials 2 and 3',
        status: 'Done',
        type: 'Learning',
        subteams: ['Mechanical'],
        assignees: ['Avery K.'],
        due: '2026-09-26',
        goalId: 'avery-onshape',
      },
    ],
    uidOf('Jordan M.'),
  )
  addTasks(
    cb,
    2,
    [
      {
        title: 'Update intake checklist',
        status: 'To do',
        subteams: ['Mechanical'],
        assignees: ['Jordan M.'],
        start: '2026-10-06',
        due: '2026-10-09',
        detail:
          'Review the current intake checklist and add the new inspection steps before the next practice run.',
        subtasks: [
          ['Review current intake steps', 'To do', ['Jordan M.'], undefined, '2026-10-07'],
          ['Add prototype inspection points', 'To do', [], undefined, '2026-10-08'],
        ],
      },
      {
        title: 'Sketch bracket v2',
        status: 'To do',
        subteams: ['Mechanical'],
        assignees: ['Avery K.'],
        start: '2026-10-08',
        due: '2026-10-10',
        detail: 'Create a revised bracket sketch for review with the mechanical group.',
      },
      {
        title: 'Intake motor stalls at full power',
        status: 'To do',
        type: 'GitHub issue',
        subteams: ['Software'],
        assignees: ['Sam R.'],
        start: '2026-10-08',
        due: '2026-10-14',
        github: 21,
      },
      {
        title: 'Update pit checklist',
        status: 'To do',
        subteams: ['Competition Ops'],
        due: '2026-10-03',
      },
      {
        title: 'Tune arm encoder',
        status: 'In progress',
        subteams: ['Software'],
        assignees: ['Sam R.'],
        start: '2026-10-02',
        due: '2026-10-08',
        detail: 'Calibrate the arm encoder and verify the positions with three repeatable runs.',
      },
      {
        title: 'Prototype claw fingers',
        status: 'In progress',
        subteams: ['Mechanical'],
        assignees: ['Mina L.', 'Avery K.'],
        start: '2026-10-05',
        due: '2026-10-12',
        detail:
          'Print and test two claw finger shapes. Keep notes on grip and release consistency.',
        subtasks: [
          ['Print finger shape A', 'Done', ['Mina L.'], '2026-10-05', '2026-10-06'],
          ['Print finger shape B', 'To do', ['Mina L.'], '2026-10-07', '2026-10-08'],
          ['Grip and release test', 'To do', ['Sam R.'], '2026-10-09', '2026-10-12'],
          ['Write up results in team notes', 'To do', []],
        ],
      },
      {
        title: 'Label control hub ports',
        status: 'In progress',
        subteams: ['Software'],
        assignees: ['Jordan M.', 'Mina L.'],
        start: '2026-10-07',
        due: '2026-10-13',
        detail: "Make a clear port map for the drive team's current wiring setup.",
      },
      {
        title: 'Test autonomous start',
        status: 'In progress',
        subteams: ['Software'],
        assignees: ['Avery K.'],
        start: '2026-10-05',
        due: '2026-10-07',
        detail: 'Run three autonomous start tests and compare the starting position consistency.',
      },
      {
        title: 'Practice autonomous route',
        status: 'Done',
        subteams: ['Software'],
        assignees: ['Sam R.'],
        due: '2026-10-02',
      },
      {
        title: 'Measure field clearance',
        status: 'Done',
        subteams: ['Mechanical'],
        assignees: ['Sam R.'],
        start: '2026-10-02',
        due: '2026-10-06',
        detail: 'Measure field clearance at the practice setup and add the numbers to team notes.',
      },
      {
        title: 'Review safety checklist',
        status: 'Done',
        subteams: ['Mechanical'],
        assignees: ['Mina L.'],
        start: '2026-10-02',
        due: '2026-10-05',
        detail: 'Walk through the current safety checklist as a team and note anything unclear.',
      },
    ],
    uidOf('Jordan M.'),
  )
  add(`${P}/teams/${cb}/tasks/prototype-claw-fingers/comments/c1`, {
    authorId: uidOf('Mina L.'),
    text: 'Shape A grips well but slips on release. Trying a softer tip on B.',
    subtaskId: null,
    createdAt: at('2026-10-06', 16),
  })

  // Other teams: [title, sprint relative to the current one (or "backlog"), due day within that sprint, status, subteam, type, student indexes]
  const relative: Record<
    string,
    [string, number | 'backlog', number | null, Status, string, TaskType, number[]][]
  > = {
    'gear-grinders': [
      ['Rebuild lift string routing', 0, 3, 'In progress', 'Mechanical', 'Task', [0, 1]],
      ['Autonomous park from both sides', 0, 8, 'To do', 'Software', 'Task', [2]],
      ['Wire color sensor', 0, 5, 'Done', 'Software', 'Task', [3]],
      ['Sketch scoring mechanism', -1, 9, 'Done', 'Mechanical', 'Idea', [0]],
      ['Drive practice: 10 cycles', 1, 4, 'To do', 'Drive Team', 'Task', [1, 3]],
      ['Research odometry pods', 'backlog', null, 'To do', 'Software', 'Learning', []],
    ],
    'bolt-brigade': [
      ['Mount control hub on new plate', 0, 2, 'Done', 'Software', 'Task', [0]],
      ['Tune drive PID', 0, 6, 'In progress', 'Software', 'Task', [1]],
      ['Pit display poster', 0, 8, 'To do', 'Outreach', 'Task', [2]],
      ['Measure intake clearance', -1, 7, 'Done', 'Mechanical', 'Task', [0, 2]],
      ["Scout our first qualifier's schedule", 1, 3, 'To do', 'Competition Ops', 'Task', [1]],
    ],
    'torque-titans': [
      ['CAD arm pivot v3', 0, 10, 'In progress', 'Mechanical', 'Task', [0]],
      ['Driver tryouts', 0, 14, 'To do', 'Drive Team', 'Task', [1, 3]],
      ['Label wiring harness', 0, 6, 'Done', 'Software', 'Task', [2]],
      ['Learn FTC Dashboard', -1, 12, 'Done', 'Software', 'Learning', [3]],
      ['Outreach demo at library', 1, 9, 'To do', 'Outreach', 'Task', [1]],
      ['Compare servo brands', 'backlog', null, 'To do', 'Mechanical', 'Learning', []],
    ],
    'servo-squad': [
      ['Prototype claw with surgical tubing', 0, 5, 'In progress', 'Mechanical', 'Task', [0, 1]],
      ['Fix tele-op slow mode', 0, 3, 'To do', 'Software', 'Task', [2]],
      ['Battery charging log', 0, 1, 'Done', 'Competition Ops', 'Task', [1]],
      ['Field reset checklist', 1, 6, 'To do', 'Drive Team', 'Task', [0]],
    ],
    'pixel-pilots': [
      ['Vision pipeline for samples', 0, 9, 'In progress', 'Software', 'Task', [0, 3]],
      ['Replace worn wheels', 0, 4, 'To do', 'Mechanical', 'Task', [1]],
      ['Organize wiring bin', 0, 2, 'Done', 'Software', 'Task', [2]],
      ['Portfolio outline', -1, 10, 'Done', 'Outreach', 'Task', [3]],
      ['Match strategy sheet', 1, 5, 'To do', 'Drive Team', 'Task', [0]],
    ],
    'iron-owls': [
      ['Square up chassis', 0, 2, 'In progress', 'Mechanical', 'Task', [0]],
      ['Write autonomous outline', 0, 5, 'To do', 'Software', 'Task', [1]],
      ['Charge and label batteries', -1, 4, 'Done', 'Competition Ops', 'Task', [2]],
      ['Practice driver swaps', 1, 3, 'To do', 'Drive Team', 'Task', [0, 2]],
    ],
  }
  const sampleSubtasks: Record<string, [string, Status][]> = {
    'Rebuild lift string routing': [
      ['Order new spectra line', 'Done'],
      ['Re-thread the pulleys', 'In progress'],
      ['Test lift under load', 'To do'],
    ],
    'Vision pipeline for samples': [
      ['Collect sample photos', 'Done'],
      ['Tune color thresholds', 'To do'],
    ],
  }
  Object.entries(relative).forEach(([teamId, tasks]) => {
    const sprints = teamSprints[teamId]!
    const current = sprintIndexOn(sprints, reference)
    const students = roster[teamId]!
    const bySprint = new Map<number | null, DemoTask[]>()
    tasks.forEach(([title, offset, dueDay, status, subteam, type, people]) => {
      const index =
        offset === 'backlog' ? null : Math.min(Math.max(current + offset, 0), sprints.length - 1)
      // Due dates fall inside their sprint (the mock-up's day offsets assume 14-day sprints).
      const due =
        index === null || dueDay === null
          ? undefined
          : shiftIsoDate(
              sprints[index]!.start,
              Math.min(dueDay, daysBetween(sprints[index]!.start, sprints[index]!.end)),
            )
      const names = people
        .map((i) => TEAMS.find((t) => slug(t.name) === teamId)!.students[i]!)
        .filter((n) => students.includes(uidOf(n)))
      const task: DemoTask = {
        title,
        status,
        type,
        subteams: [subteam],
        assignees: names,
        due,
        subtasks: (sampleSubtasks[title] ?? []).map(([t, s]) => [t, s, names, undefined, due]),
      }
      bySprint.set(index, [...(bySprint.get(index) ?? []), task])
    })
    bySprint.forEach((list, index) => addTasks(teamId, index, list, students[0]!))
  })

  // ---------- goals ----------
  type DemoEvent = {
    type: 'created' | 'checkin' | 'feedback' | 'reply' | 'paused' | 'completed'
    date: string
    author: string
    team: string
    status?: string
    note?: string
    planResult?: string
    nextStep?: string
    text?: string
    reason?: string
    unread?: boolean
  }
  type DemoGoal = {
    id: string
    student: string
    team: string
    createdTeam?: string
    season?: string
    state: string
    status: string
    created: string
    wish: string
    evidence: string
    by: [string, string | null]
    obstacle: string
    plan: string
    finished?: string
    paused?: string
    reflection?: { helped: string; different: string; next: string }
    events: DemoEvent[]
  }
  const addGoal = (goal: DemoGoal) => {
    const teamId = slug(goal.team)
    const studentId = uidOf(goal.student)
    const checkins = goal.events.filter((e) => e.type === 'checkin')
    const unread = goal.events.filter((e) => e.unread).length
    add(`${P}/goalSummaries/${goal.id}`, {
      studentId,
      teamId,
      seasonId: goal.season ?? SEASON.id,
      statement: goalStatement(goal.wish),
      status: goal.status,
      state: goal.state,
    })
    add(`${P}/goals/${goal.id}`, {
      studentId,
      teamId,
      createdTeamId: slug(goal.createdTeam ?? goal.team),
      seasonId: goal.season ?? SEASON.id,
      wish: goal.wish,
      evidence: goal.evidence,
      obstacle: goal.obstacle,
      plan: goal.plan,
      by: { label: goal.by[0], date: goal.by[1] },
      status: goal.status,
      state: goal.state,
      createdAt: at(goal.created),
      finishedAt: goal.finished ? at(goal.finished) : null,
      pausedAt: goal.paused ? at(goal.paused) : null,
      reflection: goal.reflection ?? null,
      lastCheckinAt: checkins.at(-1)?.date ?? null,
      unreadFeedback: unread,
    })
    goal.events.forEach((event, i) => {
      const data: Record<string, unknown> = {
        type: event.type,
        authorId: uidOf(event.author),
        teamId: slug(event.team),
        date: event.date,
        createdAt: at(event.date, 15),
      }
      if (event.status) data.status = event.status
      if (event.type === 'checkin') {
        data.note = event.note ?? ''
        data.planResult = event.planResult
        data.taskIds = []
        if (event.nextStep) data.nextSteps = [{ title: event.nextStep, taskId: '', sprintId: '' }]
      }
      if (event.text) data.text = event.text
      if (event.reason) data.reason = event.reason
      add(`${P}/goals/${goal.id}/events/e${String(i + 1).padStart(2, '0')}`, data)
    })
  }
  const CB = 'Circuit Breakers',
    GG = 'Gear Grinders'
  addGoal({
    id: 'avery-onshape',
    student: 'Avery K.',
    team: CB,
    state: 'active',
    status: 'Making progress',
    created: '2026-09-08',
    wish: 'design parts in Onshape',
    evidence: 'I design a bracket on my own that gets printed and used on the robot',
    by: ['Qualifier 2', '2026-11-08'],
    obstacle: 'I give up when the tutorials get confusing',
    plan: "If a tutorial gets confusing, then I'll ask Jordan to sit with me for 10 minutes at the next build night",
    events: [
      { type: 'created', date: '2026-09-08', author: 'Avery K.', team: CB },
      {
        type: 'feedback',
        date: '2026-09-09',
        author: 'Coach Rivera',
        team: CB,
        text: "Great goal. The Onshape Learning Center's part design course is a good place to start.",
      },
      {
        type: 'checkin',
        date: '2026-09-15',
        author: 'Avery K.',
        team: CB,
        status: 'Making progress',
        note: "Finished tutorial 1 with Jordan's help.",
        planResult: 'It worked',
        nextStep: 'Finish tutorials 2 and 3',
      },
      {
        type: 'feedback',
        date: '2026-09-16',
        author: 'Ms. Patel',
        team: CB,
        text: "Nice work asking for help. That's your if-then plan in action.",
        unread: true,
      },
    ],
  })
  addGoal({
    id: 'avery-driving',
    student: 'Avery K.',
    team: CB,
    state: 'paused',
    status: 'Making progress',
    created: '2026-09-08',
    paused: '2026-09-22',
    wish: 'drive consistent cycles in practice matches',
    evidence: 'I finish 5 practice matches in a row without a penalty',
    by: ['End of Sprint 5', '2026-11-16'],
    obstacle: 'I get nervous when people are watching',
    plan: "If I feel nervous at the controls, then I'll take three slow breaths before the match starts",
    events: [
      { type: 'created', date: '2026-09-08', author: 'Avery K.', team: CB },
      {
        type: 'checkin',
        date: '2026-09-15',
        author: 'Avery K.',
        team: CB,
        status: 'Making progress',
        note: 'Drove two practice matches.',
        planResult: 'It worked',
        nextStep: 'Drive at the next scrimmage',
      },
      {
        type: 'paused',
        date: '2026-09-22',
        author: 'Avery K.',
        team: CB,
        reason: 'Focusing on my other goal',
      },
    ],
  })
  // Last season, on another team: goals follow the student.
  addGoal({
    id: 'avery-wiring',
    student: 'Avery K.',
    team: CB,
    createdTeam: GG,
    season: LAST_SEASON.id,
    state: 'done',
    status: 'Got it',
    created: '2026-01-12',
    finished: '2026-03-02',
    wish: 'wire a REV Control Hub safely',
    evidence: 'I can wire and check the drivetrain motors without help',
    by: ['End of season', '2026-03-14'],
    obstacle: 'I rush and skip checking connections',
    plan: "If I'm about to power on, then I'll run the wiring checklist first",
    reflection: {
      helped: 'Labeling every wire before plugging it in',
      different: 'Ask for a wiring check earlier instead of guessing',
      next: 'Learn CAD so I can design parts, not just wire them',
    },
    events: [
      { type: 'created', date: '2026-01-12', author: 'Avery K.', team: GG },
      {
        type: 'feedback',
        date: '2026-01-13',
        author: 'Mr. Okafor',
        team: GG,
        text: 'Good plan. Use the red checklist card on the pit cart.',
      },
      {
        type: 'checkin',
        date: '2026-01-30',
        author: 'Avery K.',
        team: GG,
        status: 'Making progress',
        note: 'Wired the left drivetrain.',
        planResult: 'It worked',
        nextStep: 'Wire the arm motors',
      },
      {
        type: 'checkin',
        date: '2026-02-14',
        author: 'Avery K.',
        team: GG,
        status: 'Almost there',
        note: 'Arm motors done; one loose connector found by the checklist.',
        planResult: 'It worked',
        nextStep: 'Wire everything solo',
      },
      { type: 'completed', date: '2026-03-02', author: 'Avery K.', team: GG },
    ],
  })
  addGoal({
    id: 'jordan-review',
    student: 'Jordan M.',
    team: CB,
    state: 'active',
    status: 'Almost there',
    created: '2026-09-10',
    wish: 'run a design review that ends with a decision',
    evidence: 'Our team picks an intake design at a review I lead, with notes in Team Home',
    by: ['End of Sprint 2', '2026-10-01'],
    obstacle: 'I let discussions go on too long',
    plan: "If we pass 15 minutes on one idea, then I'll call a vote",
    events: [
      { type: 'created', date: '2026-09-10', author: 'Jordan M.', team: CB },
      {
        type: 'checkin',
        date: '2026-09-16',
        author: 'Jordan M.',
        team: CB,
        status: 'Making progress',
        note: 'Ran a practice review on wheels.',
        planResult: "It didn't come up",
        nextStep: 'Schedule the intake review',
      },
      {
        type: 'checkin',
        date: '2026-10-01',
        author: 'Jordan M.',
        team: CB,
        status: 'Almost there',
        note: 'Review is booked for Thursday.',
        planResult: 'It worked',
        nextStep: 'Lead the intake review',
      },
    ],
  })
  addGoal({
    id: 'sam-pid',
    student: 'Sam R.',
    team: CB,
    state: 'active',
    status: 'Stuck',
    created: '2026-09-05',
    wish: 'tune PID control for the arm',
    evidence: 'The arm reaches all 3 presets without overshooting in 5 tries',
    by: ['Qualifier 2', '2026-11-08'],
    obstacle: 'I change too many numbers at once',
    plan: "If the arm overshoots, then I'll change only one value and write down the result",
    events: [
      { type: 'created', date: '2026-09-05', author: 'Sam R.', team: CB },
      {
        type: 'checkin',
        date: '2026-09-16',
        author: 'Sam R.',
        team: CB,
        status: 'Making progress',
        note: 'Read the gm0 PID page.',
        planResult: "It didn't work",
        nextStep: 'Tune kP only',
      },
      {
        type: 'checkin',
        date: '2026-10-01',
        author: 'Sam R.',
        team: CB,
        status: 'Stuck',
        note: 'Still overshoots. Not sure which value to change.',
        planResult: "It didn't work",
        nextStep: 'Ask Ms. Patel to pair on tuning',
      },
    ],
  })
  // Other teams: [student index, wish, status, created days ago, check-ins [days ago, status, plan result], feedback days ago]
  const relativeGoals: Record<
    string,
    [number, string, string, number, [number, string, string][], number | null][]
  > = {
    'Gear Grinders': [
      [
        0,
        "build a lift that doesn't sag under load",
        'Making progress',
        30,
        [
          [16, 'Making progress', 'It worked'],
          [2, 'Making progress', 'It worked'],
        ],
        1,
      ],
      [
        1,
        'write tele-op code with driver presets',
        'Stuck',
        28,
        [
          [16, 'Stuck', "It didn't work"],
          [2, 'Stuck', "It didn't work"],
        ],
        null,
      ],
      [2, 'explain our robot clearly to judges', "Haven't started", 4, [], null],
      [
        3,
        'keep our pit organized at competitions',
        'Making progress',
        26,
        [
          [16, "Haven't started", "It didn't come up"],
          [3, 'Making progress', 'It worked'],
        ],
        2,
      ],
    ],
    'Bolt Brigade': [
      [
        0,
        'wire a clean, labeled control system',
        'Almost there',
        35,
        [
          [12, 'Making progress', 'It worked'],
          [2, 'Almost there', 'It worked'],
        ],
        1,
      ],
      [
        1,
        'tune drive PID for straight driving',
        'Making progress',
        25,
        [[12, 'Making progress', "It didn't come up"]],
        11,
      ],
      [
        2,
        'design our pit display',
        'Making progress',
        20,
        [[2, 'Making progress', 'It worked']],
        1,
      ],
    ],
    'Torque Titans': [
      [
        0,
        'CAD a full subassembly in Onshape',
        'Making progress',
        33,
        [
          [13, 'Making progress', 'It worked'],
          [3, 'Making progress', 'It worked'],
        ],
        2,
      ],
      [
        1,
        'drive consistent cycles in practice matches',
        'Got it',
        40,
        [
          [26, 'Making progress', 'It worked'],
          [5, 'Got it', 'It worked'],
        ],
        4,
      ],
      [
        2,
        'label and test every wiring harness',
        'Almost there',
        24,
        [[3, 'Almost there', 'It worked']],
        2,
      ],
      [3, 'run our outreach demo on my own', 'Stuck', 20, [[5, 'Stuck', "It didn't work"]], null],
    ],
    'Servo Squad': [
      [
        0,
        'design a claw that grips every sample',
        'Making progress',
        22,
        [
          [9, 'Making progress', 'It worked'],
          [2, 'Making progress', 'It worked'],
        ],
        1,
      ],
      [
        1,
        'keep a clean battery charging log',
        'Almost there',
        21,
        [[2, 'Almost there', 'It worked']],
        1,
      ],
      [2, 'learn to read motor current in code', "Haven't started", 18, [], null],
    ],
    'Pixel Pilots': [
      [
        0,
        'build a vision pipeline that finds samples',
        'Almost there',
        29,
        [
          [17, 'Making progress', 'It worked'],
          [3, 'Almost there', 'It worked'],
        ],
        2,
      ],
      [
        1,
        'replace wheels without help',
        'Making progress',
        26,
        [
          [17, 'Making progress', "It didn't come up"],
          [3, 'Making progress', 'It worked'],
        ],
        2,
      ],
      [
        2,
        'write match strategy notes',
        'Making progress',
        19,
        [[3, 'Making progress', 'It worked']],
        2,
      ],
      [
        3,
        'write our engineering portfolio intro',
        'Stuck',
        21,
        [[3, 'Stuck', "It didn't work"]],
        2,
      ],
    ],
    'Iron Owls': [
      [
        0,
        'square and brace a chassis',
        'Making progress',
        15,
        [[2, 'Making progress', 'It worked']],
        1,
      ],
      [1, 'outline an autonomous routine', "Haven't started", 6, [], null],
      [
        2,
        'charge and label every battery',
        'Making progress',
        14,
        [[2, 'Making progress', 'It worked']],
        1,
      ],
    ],
  }
  Object.entries(relativeGoals).forEach(([teamName, goals]) => {
    const team = TEAMS.find((t) => t.name === teamName)!
    const teamIndex = TEAMS.indexOf(team)
    goals.forEach(([index, wish, status, createdAgo, checkins, feedbackAgo]) => {
      const student = team.students[index]!
      const day = (ago: number) => shiftIsoDate(reference, -ago)
      const done = status === 'Got it'
      const events: DemoEvent[] = [
        { type: 'created', date: day(createdAgo), author: student, team: teamName } as DemoEvent,
        ...checkins.map(([ago, checkStatus, planResult]): DemoEvent => ({
          type: 'checkin',
          date: day(ago),
          author: student,
          team: teamName,
          status: checkStatus,
          note: '',
          planResult,
        })),
        ...(feedbackAgo === null
          ? []
          : [
              {
                type: 'feedback',
                date: day(feedbackAgo),
                author: 'Coach Rivera',
                team: teamName,
                text: 'Nice progress. Keep going with your next step.',
              } as DemoEvent,
            ]),
        ...(done
          ? [{ type: 'completed', date: day(5), author: student, team: teamName } as DemoEvent]
          : []),
      ].sort((a, b) => a.date.localeCompare(b.date))
      const [qualifier, qualifierDate] = fallQualifiers[teamIndex % fallQualifiers.length]!
      addGoal({
        id: `${uidOf(student)}-goal`,
        student,
        team: teamName,
        state: done ? 'done' : 'active',
        status,
        created: day(createdAgo),
        finished: done ? day(5) : undefined,
        wish,
        evidence: 'I can show it to a coach without help',
        by: [qualifier, qualifierDate],
        obstacle: 'I lose focus when it gets hard',
        plan: "If I get stuck for 10 minutes, then I'll ask a teammate",
        reflection: done
          ? { helped: 'Practicing every build night', different: '', next: '' }
          : undefined,
        events,
      })
    })
  })

  // ---------- announcements, huddles, Team Home ----------
  const announce = (
    id: string,
    title: string,
    body: string,
    audience: string[],
    author: string,
    daysAgo: number,
    hour: number,
  ) =>
    add(`${P}/announcements/${id}`, {
      title,
      body,
      bodyHtml: `<p>${body}</p>`,
      audience,
      authorId: uidOf(author),
      postedAt: at(shiftIsoDate(reference, -daysAgo), hour),
      emailed: true,
    })
  announce(
    'build-night',
    'Build night update',
    "Thursday's build session starts at 4:15 in the lab. Bring your notebook and finish your safety check before heading to the field.",
    [cb],
    'Coach Rivera',
    0,
    13,
  )
  announce(
    'field-practice',
    'Saturday field practice',
    "Field practice is on for Saturday from 10 to noon. Please check with your family about rides before Friday's meeting.",
    ['all'],
    'Coach Rivera',
    1,
    19,
  )
  announce(
    'sprint-3',
    'Welcome to Sprint 3',
    'This sprint is focused on getting our prototype ready for review. Pick a task you can move forward and ask for a teammate when you get stuck.',
    [cb],
    'Coach Rivera',
    3,
    12,
  )
  announce(
    'lift-review',
    'Lift design review Friday',
    "Bring your lift sketches to Friday's build night. We'll pick one design to build next sprint.",
    ['gear-grinders'],
    'Mr. Okafor',
    2,
    20,
  )

  const yesterday = shiftIsoDate(reference, -1)
  add(`${P}/huddles/h-${yesterday}`, {
    kind: 'huddle',
    date: yesterday,
    authorId: coach,
    postedAt: at(yesterday, 19),
    status:
      "Good energy yesterday. Circuit Breakers' intake prototype works 2 of 3 tries. Gear Grinders and Torque Titans are behind on their first-qualifier checklists.",
    statusHtml:
      "<p>Good energy yesterday. Circuit Breakers' intake prototype works 2 of 3 tries. Gear Grinders and Torque Titans are behind on their first-qualifier checklists.</p>",
    plan: [
      { time: '15:30', text: 'Safety check and goals for the day', audience: ['all'] },
      { time: '15:45', text: 'Build blocks; mentors float between their teams', audience: ['all'] },
      { time: '17:00', text: 'Drive practice on the field', audience: [cb] },
      { time: '17:40', text: 'Clean-up and 2-minute team stand-downs', audience: ['all'] },
    ],
    notes: 'The drill press is out for service. Route drilling to the hand drills.',
    notesHtml: '<p>The drill press is out for service. Route drilling to the hand drills.</p>',
    readBy: [coach, uidOf('Ms. Patel'), uidOf('Mr. Okafor'), uidOf('Ms. Chen')],
  })
  add(`${P}/huddles/h-${reference}`, {
    kind: 'huddle',
    date: reference,
    authorId: coach,
    postedAt: at(reference, 16),
    status:
      'Qualifier 1 is in 3 weeks. Most teams have a working drivetrain; intakes and portfolios are the gap. Several goal check-ins are overdue.',
    statusHtml:
      '<p>Qualifier 1 is in 3 weeks. Most teams have a working drivetrain; intakes and portfolios are the gap. Several goal check-ins are overdue.</p>',
    plan: [
      { time: '15:30', text: 'All-hands: qualifier timeline (5 min)', audience: ['all'] },
      { time: '15:40', text: 'Goal check-ins with anyone overdue', audience: ['all'] },
      {
        time: '16:00',
        text: 'Portfolio work session in the library',
        audience: ['pixel-pilots', 'servo-squad'],
      },
      { time: '16:00', text: 'Intake testing on the field', audience: [cb] },
      { time: '17:30', text: 'Pack-up and battery charging', audience: ['all'] },
    ],
    notes: 'Need one extra adult at the field from 4 to 5. Reply to the email if you can cover it.',
    notesHtml:
      '<p>Need one extra adult at the field from 4 to 5. Reply to the email if you can cover it.</p>',
    readBy: [coach],
  })
  add(`${P}/huddles/note-${reference}`, {
    kind: 'note',
    date: reference,
    authorId: coach,
    postedAt: at(reference, 17),
    text: 'Room 214 is locked today. Pixel Pilots, use the maker space instead.',
    textHtml: '<p>Room 214 is locked today. Pixel Pilots, use the maker space instead.</p>',
    readBy: [coach],
  })

  add(`${P}/teams/${cb}/pages/home`, {
    html: '<h2>Build notes</h2><p>Use this page for robot references, meeting notes, and team procedures.</p><h3>Build night</h3><ul><li><p>Update the build log before leaving the lab.</p></li><li><p>Put shared tools back in their labeled storage.</p></li></ul><h3>Links</h3><ul><li><p><a href="https://www.firstinspires.org/robotics/ftc">FIRST Tech Challenge</a></p></li><li><p><a href="https://ftc-docs.firstinspires.org/">FTC Docs</a></p></li></ul>',
    updatedBy: uidOf('Jordan M.'),
    updatedAt: at('2026-09-20'),
  })

  // Sanity: dates the sample relies on.
  if (toUtcDate(SEASON.start) > toUtcDate(SEASON.end))
    throw new Error('Demo season dates are inverted')
  return { docs, users }
}
