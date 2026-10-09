// Subtasks live inside their task doc, in order (they read as steps). These return a new list; write it with
// writes.updateTask(teamId, taskId, { subtasks }).
import type { Subtask } from './types'

export type NewSubtask = Pick<Subtask, 'title'> & Partial<Omit<Subtask, 'id' | 'archived'>>

export function newSubtaskId(): string {
  return `st_${crypto.randomUUID().slice(0, 8)}`
}

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

/** The subtasks people see: not archived. */
export function activeSubtasks(list: readonly Subtask[]): Subtask[] {
  return list.filter((subtask) => !subtask.archived)
}
