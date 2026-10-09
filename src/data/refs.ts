// Typed references for every collection in docs/data-model.md. Built from a Firestore instance so the rules tests can
// use the same paths and queries as the app (see src/data/index.ts for the app's instance).
import { collection, doc, type DocumentData, type Firestore } from 'firebase/firestore'
import type {
  Announcement,
  CalendarEvent,
  Comment,
  Goal,
  GoalEvent,
  GoalSummary,
  Huddle,
  Invite,
  Member,
  Page,
  Program,
  Season,
  Sprint,
  Task,
  Team,
  UserState,
} from '@/model/types'
import { converter } from './converter'

export function createRefs(db: Firestore, programId: string) {
  const col = <T extends DocumentData>(...path: string[]) =>
    collection(db, 'programs', programId, ...path).withConverter(converter<T>())

  const refs = {
    program: () => doc(db, 'programs', programId).withConverter(converter<Program>()),
    members: () => col<Member>('members'),
    member: (uid: string) => doc(refs.members(), uid),
    invites: () => col<Invite>('invites'),
    invite: (email: string) => doc(refs.invites(), email.toLowerCase()),
    seasons: () => col<Season>('seasons'),
    teams: () => col<Team>('teams'),
    team: (teamId: string) => doc(refs.teams(), teamId),
    sprints: (teamId: string) => col<Sprint>('teams', teamId, 'sprints'),
    sprint: (teamId: string, sprintId: string) => doc(refs.sprints(teamId), sprintId),
    tasks: (teamId: string) => col<Task>('teams', teamId, 'tasks'),
    task: (teamId: string, taskId: string) => doc(refs.tasks(teamId), taskId),
    comments: (teamId: string, taskId: string) =>
      col<Comment>('teams', teamId, 'tasks', taskId, 'comments'),
    teamEvents: (teamId: string) => col<CalendarEvent>('teams', teamId, 'events'),
    homePage: (teamId: string) => doc(col<Page>('teams', teamId, 'pages'), 'home'),
    programEvents: () => col<CalendarEvent>('events'),
    announcements: () => col<Announcement>('announcements'),
    huddles: () => col<Huddle>('huddles'),
    huddle: (huddleId: string) => doc(refs.huddles(), huddleId),
    goalSummaries: () => col<GoalSummary>('goalSummaries'),
    goals: () => col<Goal>('goals'),
    goal: (goalId: string) => doc(refs.goals(), goalId),
    goalEvents: (goalId: string) => col<GoalEvent>('goals', goalId, 'events'),
    userState: (uid: string) => doc(col<UserState>('userState'), uid),
  }
  return refs
}

export type Refs = ReturnType<typeof createRefs>
