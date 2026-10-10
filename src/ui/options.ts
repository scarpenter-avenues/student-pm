// Choices shared by menus, cells, and the task panel.
import type { Status, TaskType } from '@/model/types'

export const STATUSES: readonly Status[] = ['To do', 'In progress', 'Done']
/** GitHub issue isn't pickable: only the GitHub sync creates it. */
export const PICKABLE_TYPES: readonly TaskType[] = ['Task', 'Learning', 'Idea']

export const statusOptions = STATUSES.map((value) => ({ value, label: value }))
export const typeOptions = PICKABLE_TYPES.map((value) => ({ value, label: value }))
export const isTypeLocked = (type: TaskType) => type === 'GitHub issue'
