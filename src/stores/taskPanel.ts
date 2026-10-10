// Which task the side panel shows. Any view opens it; AppShell renders it.
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import type { Status } from '@/model/types'

export type PanelTarget =
  | { mode: 'edit'; teamId: string; taskId: string; subtaskId?: string | null }
  | {
      mode: 'create'
      teamId: string
      sprintId: string | null
      status: Status
      assigneeIds: string[]
    }

export const useTaskPanel = defineStore('taskPanel', () => {
  const target = shallowRef<PanelTarget | null>(null)
  return {
    target,
    open: (teamId: string, taskId: string, subtaskId: string | null = null) =>
      (target.value = { mode: 'edit', teamId, taskId, subtaskId }),
    create: (
      teamId: string,
      sprintId: string | null,
      status: Status = 'To do',
      assigneeIds: string[] = [],
    ) => (target.value = { mode: 'create', teamId, sprintId, status, assigneeIds }),
    close: () => (target.value = null),
  }
})
