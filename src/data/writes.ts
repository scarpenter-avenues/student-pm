// Writes the views share. Each one matches what firestore.rules accepts (tests/rules/queries.test.ts runs them).
//
// Offline: Firestore applies a write to the local cache at once (listeners update immediately) and sends it when the
// connection is back; the returned promise resolves only when the server confirms. So UI code shouldn't wait on it
// before moving on; catch it to show an error (e.g. the rules refused the write).
import {
  arrayUnion,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type FieldValue,
  type UpdateData,
} from 'firebase/firestore'
import {
  goalStatement,
  type Announcement,
  type CalendarEvent,
  type Comment,
  type Goal,
  type GoalEvent,
  type GoalSummary,
  type Huddle,
  type Sprint,
  type Subtask,
  type Task,
  type Team,
} from '@/model/types'
import type { Refs } from './refs'

/** What a new task needs; everything else gets the usual default. */
export type NewTask = Pick<Task, 'title'> &
  Partial<Omit<Task, 'rank' | 'archived' | 'github' | 'createdBy' | 'createdAt' | 'updatedAt'>>

/** Fields people change on a task (createdBy/createdAt/github never change; archiving has its own writes). */
export type TaskChanges = Partial<
  Pick<
    Task,
    | 'title'
    | 'type'
    | 'status'
    | 'sprintId'
    | 'rank'
    | 'subteamIds'
    | 'assigneeIds'
    | 'start'
    | 'due'
    | 'descriptionHtml'
    | 'goalId'
    | 'subtasks'
  >
>

function summaryOf(goal: Goal): GoalSummary {
  return {
    studentId: goal.studentId,
    teamId: goal.teamId,
    seasonId: goal.seasonId,
    statement: goalStatement(goal.wish),
    status: goal.status,
    state: goal.state,
  }
}

function event(
  authorId: string,
  teamId: string,
  date: string,
  fields: Omit<GoalEvent, 'authorId' | 'teamId' | 'date' | 'createdAt'>,
): GoalEvent & { id: string } {
  return { ...fields, id: '', authorId, teamId, date, createdAt: serverTimestamp() as never }
}

export function createWrites(refs: Refs, currentUid: () => string) {
  return {
    // ---------- tasks ----------
    /** Adds a task at `rank` (see src/model/rank.ts). Returns its id right away, and the server write. */
    addTask(teamId: string, fields: NewTask, rank: string) {
      const ref = doc(refs.tasks(teamId))
      const written = setDoc(ref, {
        id: ref.id,
        type: 'Task',
        status: 'To do',
        sprintId: null,
        subteamIds: [],
        assigneeIds: [],
        start: null,
        due: null,
        descriptionHtml: '',
        subtasks: [],
        goalId: null,
        ...fields,
        title: fields.title.trim(),
        rank,
        github: null,
        archived: null,
        createdBy: currentUid(),
        createdAt: serverTimestamp() as never,
        updatedAt: serverTimestamp() as never,
      })
      return { id: ref.id, written }
    },

    updateTask(teamId: string, taskId: string, changes: TaskChanges) {
      return updateDoc(refs.task(teamId, taskId), {
        ...changes,
        updatedAt: serverTimestamp(),
      } as UpdateData<Task>)
    },

    /** Archive instead of delete: the task disappears from every view but keeps its subtasks and comments. */
    archiveTask(teamId: string, taskId: string, from: string) {
      return updateDoc(refs.task(teamId, taskId), {
        archived: { by: currentUid(), at: serverTimestamp() as FieldValue, from },
        updatedAt: serverTimestamp(),
      } as UpdateData<Task>)
    },

    restoreTask(teamId: string, taskId: string) {
      return updateDoc(refs.task(teamId, taskId), { archived: null, updatedAt: serverTimestamp() })
    },

    /** Permanent. Mentors and coaches only, and only for archived tasks (the rules check both). */
    deleteTask(teamId: string, taskId: string) {
      return deleteDoc(refs.task(teamId, taskId))
    },

    /**
     * "Make it a task": the subtask becomes its own task right after its parent (same sprint, fields, description),
     * in one batch. Its comments stay on the parent task (shown there as from a former subtask): moving them would
     * mean deleting other people's comments, which only their authors and adults may do.
     */
    promoteSubtask(teamId: string, parent: Task & { id: string }, subtaskId: string, rank: string) {
      const subtask = parent.subtasks.find((item) => item.id === subtaskId)
      if (!subtask) return { id: '', written: Promise.reject(new Error('That subtask is gone.')) }
      const ref = doc(refs.tasks(teamId))
      const batch = writeBatch(refs.task(teamId, parent.id).firestore)
      batch.set(ref, {
        id: ref.id,
        title: subtask.title,
        type: subtask.type === 'GitHub issue' ? 'Task' : subtask.type,
        status: subtask.status,
        sprintId: parent.sprintId,
        rank,
        subteamIds: subtask.subteamIds,
        assigneeIds: subtask.assigneeIds,
        start: subtask.start,
        due: subtask.due,
        descriptionHtml: subtask.descriptionHtml,
        subtasks: [],
        goalId: parent.goalId,
        github: null,
        archived: null,
        createdBy: currentUid(),
        createdAt: serverTimestamp() as never,
        updatedAt: serverTimestamp() as never,
      })
      batch.update(refs.task(teamId, parent.id), {
        subtasks: parent.subtasks.filter((item: Subtask) => item.id !== subtaskId),
        updatedAt: serverTimestamp(),
      })
      return { id: ref.id, written: batch.commit() }
    },

    // ---------- sprints and teams ----------
    /** Sprint dates and objectives (leads, mentors, coaches). */
    updateSprint(
      teamId: string,
      sprintId: string,
      changes: Partial<Pick<Sprint, 'start' | 'end' | 'objectives'>>,
    ) {
      return updateDoc(refs.sprint(teamId, sprintId), changes)
    },
    /** Several sprints at once (moving an end date shifts the later sprints). */
    updateSprints(teamId: string, changes: { id: string; start: string; end: string }[]) {
      const batch = writeBatch(refs.team(teamId).firestore)
      changes.forEach(({ id, start, end }) => batch.update(refs.sprint(teamId, id), { start, end }))
      return batch.commit()
    },
    updateTeam(teamId: string, changes: Partial<Omit<Team, 'createdAt'>>) {
      return updateDoc(refs.team(teamId), changes as UpdateData<Team>)
    },

    // ---------- Team Home and events ----------
    saveHomePage(teamId: string, html: string) {
      return setDoc(refs.homePage(teamId), {
        id: 'home',
        html,
        updatedBy: currentUid(),
        updatedAt: serverTimestamp() as never,
      })
    },
    /** A team's own event (teamId), or a program-wide one (null; program coaches only). */
    saveEvent(teamId: string | null, eventId: string | null, fields: CalendarEvent) {
      const collection = teamId ? refs.teamEvents(teamId) : refs.programEvents()
      const ref = eventId ? doc(collection, eventId) : doc(collection)
      return setDoc(ref, { ...fields, id: ref.id })
    },
    deleteEvent(teamId: string | null, eventId: string) {
      return deleteDoc(doc(teamId ? refs.teamEvents(teamId) : refs.programEvents(), eventId))
    },

    // ---------- comments ----------
    addComment(teamId: string, taskId: string, text: string, subtaskId: string | null = null) {
      const ref = doc(refs.comments(teamId, taskId))
      const comment: Comment & { id: string } = {
        id: ref.id,
        authorId: currentUid(),
        text: text.trim(),
        subtaskId,
        createdAt: serverTimestamp() as never,
      }
      return setDoc(ref, comment)
    },

    // ---------- announcements and huddles ----------
    /** audience: ["all"] (program coaches) or team ids. `emailed` records the request; sending needs a server. */
    postAnnouncement(
      fields: Pick<Announcement, 'title' | 'bodyHtml' | 'body' | 'audience' | 'emailed'>,
    ) {
      const ref = doc(refs.announcements())
      return setDoc(ref, {
        ...fields,
        id: ref.id,
        authorId: currentUid(),
        postedAt: serverTimestamp() as never,
      })
    },
    updateAnnouncement(
      id: string,
      fields: Pick<Announcement, 'title' | 'bodyHtml' | 'body' | 'audience'>,
    ) {
      return updateDoc(doc(refs.announcements(), id), fields)
    },
    deleteAnnouncement(id: string) {
      return deleteDoc(doc(refs.announcements(), id))
    },
    restoreAnnouncement(announcement: Announcement & { id: string }) {
      return setDoc(doc(refs.announcements(), announcement.id), announcement)
    },
    /** A huddle or quick note (program coaches). The author has read it. */
    postHuddle(fields: Omit<Huddle, 'authorId' | 'postedAt' | 'readBy'>) {
      const ref = doc(refs.huddles())
      return setDoc(ref, {
        ...fields,
        id: ref.id,
        authorId: currentUid(),
        postedAt: serverTimestamp() as never,
        readBy: [currentUid()],
      })
    },
    deleteHuddle(id: string) {
      return deleteDoc(refs.huddle(id))
    },

    // ---------- goals ----------
    // A goal is two docs (the private goal and the team-readable summary) plus its event history. Each change writes
    // the goal, the summary (when the statement, status, or state changes), and an event in one batch.

    /** A new goal (the student). Returns its id. */
    createGoal(
      fields: Pick<Goal, 'teamId' | 'seasonId' | 'wish' | 'evidence' | 'obstacle' | 'plan' | 'by'>,
      today: string,
    ) {
      const uid = currentUid()
      const ref = doc(refs.goals())
      const batch = writeBatch(ref.firestore)
      const goal: Goal & { id: string } = {
        id: ref.id,
        ...fields,
        studentId: uid,
        createdTeamId: fields.teamId,
        status: "Haven't started",
        state: 'active',
        createdAt: serverTimestamp() as never,
        finishedAt: null,
        pausedAt: null,
        reflection: null,
        lastCheckinAt: null,
        lastFeedbackAt: null,
        unreadFeedback: 0,
      }
      batch.set(ref, goal)
      batch.set(doc(refs.goalSummaries(), ref.id), summaryOf(goal))
      batch.set(doc(refs.goalEvents(ref.id)), event(uid, fields.teamId, today, { type: 'created' }))
      return { id: ref.id, written: batch.commit() }
    },

    /** Changes to a goal plus the event that records them (check-in, pause, resume, edit, completed, changed). */
    updateGoal(
      goal: Goal & { id: string },
      changes: Partial<Omit<Goal, 'studentId' | 'teamId' | 'createdAt'>>,
      record: Omit<GoalEvent, 'authorId' | 'teamId' | 'date' | 'createdAt'> | null,
      today: string,
    ) {
      const uid = currentUid()
      const batch = writeBatch(refs.goal(goal.id).firestore)
      batch.update(refs.goal(goal.id), changes as UpdateData<Goal>)
      const next = { ...goal, ...changes }
      if (next.wish !== goal.wish || next.status !== goal.status || next.state !== goal.state)
        batch.set(doc(refs.goalSummaries(), goal.id), summaryOf(next))
      if (record) batch.set(doc(refs.goalEvents(goal.id)), event(uid, goal.teamId, today, record))
      return batch.commit()
    },

    /** Coach feedback (mentors and coaches): the event, one more unread for the student, and the feedback date. */
    postFeedback(
      goal: Goal & { id: string },
      text: string,
      today: string,
      aboutEventId: string | null = null,
    ) {
      const uid = currentUid()
      const batch = writeBatch(refs.goal(goal.id).firestore)
      batch.set(
        doc(refs.goalEvents(goal.id)),
        event(uid, goal.teamId, today, {
          type: 'feedback',
          text,
          ...(aboutEventId ? { aboutEventId } : {}),
        }),
      )
      batch.update(refs.goal(goal.id), {
        unreadFeedback: goal.unreadFeedback + 1,
        lastFeedbackAt: today,
      })
      return batch.commit()
    },

    /** The student replies to a coach's feedback. */
    replyToFeedback(goal: Goal & { id: string }, replyTo: string, text: string, today: string) {
      return setDoc(
        doc(refs.goalEvents(goal.id)),
        event(currentUid(), goal.teamId, today, { type: 'reply', replyTo, text }),
      )
    },

    /** The student has seen their new feedback. */
    markFeedbackRead(goalId: string) {
      return updateDoc(refs.goal(goalId), { unreadFeedback: 0 })
    },

    // ---------- read markers ----------
    markAnnouncementsRead(announcementIds: string[]) {
      if (!announcementIds.length) return Promise.resolve()
      const read = Object.fromEntries(announcementIds.map((id) => [id, true as const]))
      return setDoc(refs.userState(currentUid()), { announcementsRead: read }, { merge: true })
    },

    markHuddlesRead(huddleIds: string[]) {
      return Promise.all(
        huddleIds.map((id) => updateDoc(refs.huddle(id), { readBy: arrayUnion(currentUid()) })),
      )
    },
  }
}

export type Writes = ReturnType<typeof createWrites>
