// Subtasks live inside their task doc, in order (they read as steps). These return a new list; write it with
// writes.updateTask(teamId, taskId, { subtasks }).
import type { Subtask } from './types'

export type NewSubtask = Pick<Subtask, 'title'> & Partial<Omit<Subtask, 'id' | 'archived'>>

/** A short random id for a new subtask. It only has to be unique within its task. */
export function newSubtaskId(): string {
  return `st_${crypto.randomUUID().slice(0, 8)}`
}

/** The list with a new subtask at the end (a new list; the one passed in is left alone). */
export function addSubtask(list: readonly Subtask[], fields: NewSubtask): Subtask[] {
  return [
    ...list,
    {
      id: newSubtaskId(),
      status: 'To do',
      assigneeIds: [],
      start: null,
      due: null,
      subteamIds: [],
      type: 'Task',
      descriptionHtml: '',
      archived: null,
      ...fields,
    },
  ]
}

/**
 * The list with one subtask changed. Every function here returns a new list, because the whole list is saved
 * back to the task at once.
 */
export function updateSubtask(
  list: readonly Subtask[],
  id: string,
  changes: Partial<Omit<Subtask, 'id'>>,
): Subtask[] {
  return list.map((subtask) => (subtask.id === id ? { ...subtask, ...changes } : subtask))
}

/** Moves the subtask at `from` to index `to`. */
export function moveSubtask(list: readonly Subtask[], from: number, to: number): Subtask[] {
  const next = [...list]
  const [moved] = next.splice(from, 1)
  if (moved) next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
  return next
}

/** Puts a subtask between two others (a drag and drop): after `beforeId`, before `afterId`; null is an end. */
export function placeSubtask(
  list: readonly Subtask[],
  id: string,
  beforeId: string | null,
  afterId: string | null,
): Subtask[] {
  const moved = list.find((item) => item.id === id)
  if (!moved) return [...list]
  const rest = list.filter((item) => item.id !== id)
  const after = afterId ? rest.findIndex((item) => item.id === afterId) : -1
  const before = beforeId ? rest.findIndex((item) => item.id === beforeId) : -1
  const at = after >= 0 ? after : before >= 0 ? before + 1 : rest.length
  return [...rest.slice(0, at), moved, ...rest.slice(at)]
}

/** The subtasks people see: not archived. */
export function activeSubtasks(list: readonly Subtask[]): Subtask[] {
  return list.filter((subtask) => !subtask.archived)
}
