// The queries the app runs (docs/data-model.md → "Queries the app runs"). Each is scoped to one team or one person so
// reads stay small, and each must pass the security rules as written: tests/rules/queries.test.ts runs every one of
// them as the roles that use it. New composite indexes go in firestore.indexes.json (the emulator doesn't check them).
import { limit, orderBy, query, where } from 'firebase/firestore'
import type { Refs } from './refs'

export function createQueries(refs: Refs) {
  return {
    // ---------- tasks ----------
    /** Board, List, Timeline: one sprint, in rank (priority) order. */
    sprintTasks: (teamId: string, sprintId: string) =>
      query(
        refs.tasks(teamId),
        where('sprintId', '==', sprintId),
        where('archived', '==', null),
        orderBy('rank'),
      ),
    /** My Tasks: the same, assigned to one person. */
    myTasks: (teamId: string, sprintId: string, uid: string) =>
      query(
        refs.tasks(teamId),
        where('assigneeIds', 'array-contains', uid),
        where('sprintId', '==', sprintId),
        where('archived', '==', null),
        orderBy('rank'),
      ),
    /** Planning: every unarchived task (grouped by sprint in the app; Backlog is sprintId null). */
    planningTasks: (teamId: string) =>
      query(refs.tasks(teamId), where('archived', '==', null), orderBy('rank')),
    /** Settings → Archived tasks. */
    archivedTasks: (teamId: string) => query(refs.tasks(teamId), where('archived', '!=', null)),
    comments: (teamId: string, taskId: string) =>
      query(refs.comments(teamId, taskId), orderBy('createdAt')),

    // ---------- sprints, people, events ----------
    sprints: (teamId: string, seasonId: string) =>
      query(refs.sprints(teamId), where('seasonId', '==', seasonId), orderBy('index')),
    /** A team's roster (program coaches are on every team: add `coaches()`). */
    teamMembers: (teamId: string) =>
      query(refs.members(), where('teamIds', 'array-contains', teamId)),
    coaches: () => query(refs.members(), where('role', '==', 'coach')),
    /** Program settings → People (program coaches). */
    allMembers: () => query(refs.members(), orderBy('displayName')),
    teamEvents: (teamId: string) => query(refs.teamEvents(teamId), orderBy('date')),
    programEvents: () => query(refs.programEvents(), orderBy('date')),

    // ---------- announcements, huddles ----------
    /** A team's feed: its own posts and program-wide ones, newest first. */
    teamAnnouncements: (teamId: string) =>
      query(
        refs.announcements(),
        where('audience', 'array-contains-any', [teamId, 'all']),
        orderBy('postedAt', 'desc'),
      ),
    /** Coaches' Dashboard → Announcements (program coaches). */
    allAnnouncements: () => query(refs.announcements(), orderBy('postedAt', 'desc')),
    huddles: (count = 20) => query(refs.huddles(), orderBy('postedAt', 'desc'), limit(count)),

    // ---------- goals ----------
    /** Team goal cards: statement and status of active goals. */
    teamGoalCards: (teamId: string) =>
      query(refs.goalSummaries(), where('teamId', '==', teamId), where('state', '==', 'active')),
    myGoals: (uid: string) => query(refs.goals(), where('studentId', '==', uid)),
    /** Adults: goals of students on these teams (up to 30; mentors pass only their own teams). */
    teamGoals: (teamIds: string[]) => query(refs.goals(), where('teamId', 'in', teamIds)),
    /**
     * A goal's history, oldest first. Mentors must pass their team ids: they may read only events written while the
     * student was on one of their teams, and a query has to say so for the rules to allow it.
     */
    goalEvents: (goalId: string, onlyTeamIds?: string[]) =>
      onlyTeamIds
        ? query(refs.goalEvents(goalId), where('teamId', 'in', onlyTeamIds), orderBy('createdAt'))
        : query(refs.goalEvents(goalId), orderBy('createdAt')),
  }
}

export type Queries = ReturnType<typeof createQueries>
