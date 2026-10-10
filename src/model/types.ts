// Firestore document types. The source of truth for these is docs/data-model.md; keep the two in step.
// Dates without times are "YYYY-MM-DD" strings; moments are Firestore Timestamps.
import type { Timestamp } from 'firebase/firestore'

export type Role = 'student' | 'lead' | 'mentor' | 'coach'
export type Status = 'To do' | 'In progress' | 'Done'
export type TaskType = 'Task' | 'Learning' | 'Idea' | 'GitHub issue'
export type SubteamColor = 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'teal' | 'pink' | 'gray'
export type GoalStatus = "Haven't started" | 'Stuck' | 'Making progress' | 'Almost there' | 'Got it'
export type GoalState = 'active' | 'paused' | 'done' | 'changed'
export type PlanResult = 'It worked' | "It didn't work" | "It didn't come up"
export type EventType = 'Competition' | 'Work session' | 'Other'

export const ADULT_ROLES: readonly Role[] = ['mentor', 'coach']
export const ROLES: readonly Role[] = ['student', 'lead', 'mentor', 'coach']
export const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  lead: 'Team lead',
  mentor: 'Team mentor',
  coach: 'Program coach',
}
export const SUBTEAM_COLORS: readonly SubteamColor[] = [
  'red',
  'green',
  'yellow',
  'blue',
  'purple',
  'teal',
  'pink',
  'gray',
]
/** Team color presets; teams may also use any "#rrggbb". */
export const TEAM_COLOR_PRESETS = [
  'green',
  'teal',
  'blue',
  'navy',
  'purple',
  'pink',
  'red',
  'orange',
  'yellow',
  'gray',
] as const

/** users/{uid} */
export interface UserDoc {
  programId: string
}

export interface ProgramAuth {
  google?: { domains: string[] }
  password?: { roles: Role[] }
}

export interface Subteam {
  id: string
  name: string
  color: SubteamColor
  description: string
}

/** programs/{programId} */
export interface Program {
  name: string
  auth: ProgramAuth
  subteamDefaults: Subteam[]
  currentSeasonId: string
  /** The tappable ideas in the set-a-goal steps. A list that's missing uses the built-in defaults. */
  goalIdeas?: Partial<Record<GoalIdeaKey, string[]>>
  /** The plan "Import default" puts in a new huddle. Missing: the built-in one (src/model/huddles.ts). */
  huddlePlan?: HuddlePlanRow[]
  /** Set by the email sender when it's installed (scripts/email). Until then the app offers no email. */
  email?: { on: boolean }
}

/** The set-a-goal steps that offer tappable ideas. */
export type GoalIdeaKey = 'wish' | 'evidence' | 'obstacle' | 'plan' | 'firstStep'

/** programs/{p}/public/signIn: what the sign-in page needs before anyone has signed in. Anyone can read it. */
export interface PublicSignIn {
  name: string
  auth: ProgramAuth
}

/** A document's data plus its id. */
export type WithId<T> = T & { id: string }

/** programs/{p}/members/{uid} */
export interface Member {
  displayName: string
  role: Role
  teamIds: string[]
  /** teamId → subteam ids */
  subteams: Record<string, string[]>
  joinedAt: Timestamp
}

/** programs/{p}/members/{uid}/private/contact */
export interface Contact {
  email: string
}

/** programs/{p}/invites/{emailLower} */
export interface Invite {
  email: string
  displayName: string
  role: Role
  teamIds: string[]
  subteams: Record<string, string[]>
  invitedBy: string
  invitedAt: Timestamp
}

/** programs/{p}/seasons/{seasonId} */
export interface Season {
  name: string
  start: string
  end: string
}

export interface GithubSettings {
  repo: string | null
  importIssues: boolean
  closeOnDone: boolean
}

/** programs/{p}/teams/{teamId} */
export interface Team {
  name: string
  number: string
  color: string
  sprintDays: number
  seasonIds: string[]
  subteams: Subteam[]
  github: GithubSettings
  createdAt: Timestamp
}

export interface Objective {
  id: string
  text: string
  subteamIds: string[]
  met: boolean
}

/** programs/{p}/teams/{t}/sprints/{sprintId} */
export interface Sprint {
  seasonId: string
  name: string
  index: number
  start: string
  end: string
  objectives: Objective[]
}

export interface Archived {
  by: string
  at: Timestamp
  from: string
}

export interface Subtask {
  id: string
  title: string
  status: Status
  assigneeIds: string[]
  start: string | null
  due: string | null
  subteamIds: string[]
  type: TaskType
  descriptionHtml: string
  archived: { by: string; at: Timestamp } | null
}

export interface GithubIssueRef {
  repo: string
  number: number
  url: string
  state: 'open' | 'closed'
}

/** programs/{p}/teams/{t}/tasks/{taskId} */
export interface Task {
  title: string
  type: TaskType
  status: Status
  /** null = Backlog */
  sprintId: string | null
  /** Fractional index; order is priority. */
  rank: string
  subteamIds: string[]
  assigneeIds: string[]
  start: string | null
  due: string | null
  descriptionHtml: string
  subtasks: Subtask[]
  goalId: string | null
  github: GithubIssueRef | null
  archived: Archived | null
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** programs/{p}/teams/{t}/tasks/{taskId}/comments/{commentId} */
export interface Comment {
  authorId: string
  text: string
  subtaskId: string | null
  createdAt: Timestamp
}

/** programs/{p}/events/{id} (program-wide) and programs/{p}/teams/{t}/events/{id} (team) */
export interface CalendarEvent {
  title: string
  date: string
  time: string
  location: string
  type: EventType
  /** "If qualified": skipped by the countdown. */
  conditional: boolean
}

/** programs/{p}/teams/{t}/pages/home */
export interface Page {
  html: string
  updatedBy: string
  updatedAt: Timestamp
}

/** programs/{p}/announcements/{id} */
export interface Announcement {
  title: string
  bodyHtml: string
  body: string
  /** ["all"] or team ids */
  audience: string[]
  authorId: string
  postedAt: Timestamp
  emailed: boolean
}

export interface HuddlePlanRow {
  time: string
  text: string
  /** ["all"], ["adults"], or team ids */
  audience: string[]
  /** Optional: the coach or mentor running it (member uid). */
  runBy?: string
}

/** programs/{p}/huddles/{id} */
export interface Huddle {
  kind: 'huddle' | 'note'
  date: string
  authorId: string
  postedAt: Timestamp
  statusHtml?: string
  status?: string
  plan?: HuddlePlanRow[]
  notesHtml?: string
  notes?: string
  textHtml?: string
  text?: string
  readBy: string[]
  /** Set when a program coach edits a posted huddle. */
  editedAt?: Timestamp
}

/**
 * programs/{p}/outbox/{kind}-{sourceId}: a post waiting to be emailed. It names the post and nothing else (no
 * addresses, no text); the sender (scripts/email) works out who gets it. One per post, so nothing is sent twice.
 */
export interface OutboxItem {
  kind: 'announcement' | 'huddle'
  sourceId: string
  createdBy: string
  createdAt: Timestamp
  /** Clients only ever write "pending"; the sender moves it on. */
  state: 'pending' | 'sending' | 'sent' | 'skipped' | 'failed'
  sentAt?: Timestamp
  /** How many people it went to. */
  recipients?: number
  /** Why it was skipped or failed. */
  note?: string
}

/** programs/{p}/goalSummaries/{goalId}: what teammates may see. */
export interface GoalSummary {
  studentId: string
  teamId: string
  seasonId: string
  statement: string
  status: GoalStatus
  state: GoalState
}

/** programs/{p}/goals/{goalId}: the private part. */
export interface Goal {
  studentId: string
  teamId: string
  createdTeamId: string
  seasonId: string
  wish: string
  evidence: string
  obstacle: string
  plan: string
  by: { label: string; date: string | null }
  status: GoalStatus
  state: GoalState
  createdAt: Timestamp
  finishedAt: Timestamp | null
  pausedAt: Timestamp | null
  reflection: { helped: string; different: string; next: string } | null
  lastCheckinAt: string | null
  unreadFeedback: number
  /** Date of the latest coach feedback, so coach flags need only the goal doc. */
  lastFeedbackAt: string | null
}

/** programs/{p}/goals/{goalId}/events/{eventId} */
export interface GoalEvent {
  type:
    | 'created'
    | 'checkin'
    | 'feedback'
    | 'reply'
    | 'paused'
    | 'resumed'
    | 'completed'
    | 'changed'
    | 'edit'
  authorId: string
  teamId: string
  date: string
  createdAt: Timestamp
  status?: GoalStatus
  taskIds?: string[]
  note?: string
  planResult?: PlanResult
  newPlan?: string
  nextSteps?: { title: string; taskId: string; sprintId: string }[]
  text?: string
  replyTo?: string
  aboutEventId?: string
  reason?: string
  change?: string
  to?: string
}

/** programs/{p}/userState/{uid} */
export interface UserState {
  announcementsRead: Record<string, true>
  dismissed: Record<string, string>
}

/** The goal statement as shown everywhere: the wish, capitalized ("Learn Java for FTC"). */
export function goalStatement(wish: string): string {
  const text = wish.trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}
