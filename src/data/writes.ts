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
  type FieldValue,
  type UpdateData,
} from 'firebase/firestore'
import type { Comment, Task } from '@/model/types'
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
