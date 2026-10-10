// Task and subtask edits shared by the task tables, cards, and the dashboard. Writes show at once (the local cache
// updates listeners) and report failures in a toast. Archiving offers Undo.
import { Timestamp } from 'firebase/firestore'
import { writes, type NewTask } from '@/data'
import { rankBetween, rankForMove } from '@/model/rank'
import type { TaskDrop } from '@/ui/dragSort'
import { addSubtask, moveSubtask, updateSubtask, type NewSubtask } from '@/model/subtasks'
import type { Subtask, Task, WithId } from '@/model/types'
import type { TaskChanges } from '@/data/writes'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import type { TeamData } from './useTeamData'

export type SubtaskChanges = Partial<Omit<Subtask, 'id'>>

export function useTaskEdits(team: TeamData) {
  const toast = useToast()
  const session = useSession()
  const teamId = () => team.teamId.value!
  const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)
  /** The latest copy of a task (the one passed in may be a render behind). */
  const latest = (task: WithId<Task>) =>
    team.tasks.value.find((item) => item.id === task.id) ?? task

  function save(
    task: WithId<Task>,
    subtaskId: string | null,
    changes: TaskChanges & SubtaskChanges,
  ) {
    if (subtaskId) {
      // Sprint, rank, goal, and subtasks belong to the parent task.
      const fields: SubtaskChanges = Object.fromEntries(
        Object.entries(changes).filter(
          ([key]) => !['sprintId', 'rank', 'goalId', 'subtasks'].includes(key),
        ),
      )
      return writes
        .updateTask(teamId(), task.id, {
          subtasks: updateSubtask(latest(task).subtasks, subtaskId, fields),
        })
        .catch(fail)
    }
    return writes.updateTask(teamId(), task.id, changes).catch(fail)
  }

  function archive(task: WithId<Task>, subtaskId: string | null = null, { quiet = false } = {}) {
    const id = teamId()
    if (subtaskId) {
      const archived = { by: session.member?.id ?? '', at: Timestamp.now() }
      const title = task.subtasks.find((item) => item.id === subtaskId)?.title ?? 'subtask'
      save(task, subtaskId, { archived })
      if (!quiet)
        toast.show(`Archived “${title}”`, { label: 'Undo', run: () => restore(task, subtaskId) })
      return
    }
    writes.archiveTask(id, task.id, team.sprintName(task.sprintId)).catch(fail)
    if (!quiet)
      toast.show(`Archived “${task.title}”`, { label: 'Undo', run: () => restore(task, null) })
  }

  function restore(task: WithId<Task>, subtaskId: string | null) {
    if (subtaskId) return save(task, subtaskId, { archived: null })
    return writes.restoreTask(teamId(), task.id).catch(fail)
  }

  /** Moves list[from] to index `to` within the list shown (a sprint, a status group). */
  function move(list: readonly WithId<Task>[], from: number, to: number) {
    const task = list[from]
    const clamped = Math.max(0, Math.min(to, list.length - 1))
    if (!task || clamped === from) return
    save(task, null, {
      rank: rankForMove(
        list.map((item) => item.rank),
        from,
        clamped,
      ),
    })
  }

  /** A drag-and-drop move (see v-drag-sort): between its new neighbors, plus any status or sprint change. */
  function drop(move: TaskDrop, changes: Pick<TaskChanges, 'status' | 'sprintId'> = {}) {
    const task = team.tasks.value.find((item) => item.id === move.id)
    if (!task) return
    const rankOf = (id: string | null) =>
      (id && team.tasks.value.find((item) => item.id === id)?.rank) || null
    const rank = rankBetween(rankOf(move.beforeId), rankOf(move.afterId))
    const changed = Object.fromEntries(
      Object.entries(changes).filter(([key, value]) => task[key as keyof Task] !== value),
    )
    save(task, null, { ...changed, rank })
    return task
  }

  function moveSub(task: WithId<Task>, visible: readonly Subtask[], from: number, to: number) {
    const all = latest(task).subtasks
    const fromIndex = all.findIndex((item) => item.id === visible[from]?.id)
    const toIndex = all.findIndex(
      (item) => item.id === visible[Math.max(0, Math.min(to, visible.length - 1))]?.id,
    )
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return
    save(task, null, { subtasks: moveSubtask(all, fromIndex, toIndex) })
  }

  function add(fields: NewTask, rank: string) {
    const { id, written } = writes.addTask(teamId(), fields, rank)
    written.catch(fail)
    return id
  }

  function addSub(task: WithId<Task>, fields: NewSubtask) {
    return save(task, null, { subtasks: addSubtask(latest(task).subtasks, fields) })
  }

  return { save, archive, restore, move, drop, moveSub, add, addSub, fail }
}
