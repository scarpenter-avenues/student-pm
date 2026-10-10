// What Board, List, Timeline, and My Tasks show: the chosen sprint's tasks, filtered by subteam, assignee, and search.
// My Tasks is the simplest view: the current sprint, assigned to you, no filters.
import { computed, watch } from 'vue'
import type { Sprint, Task, WithId } from '@/model/types'
import { useSession } from '@/stores/session'
import { useTaskFilters } from '@/stores/taskFilters'
import { useTeam } from './useTeamData'

export function useTaskView(mine: () => boolean) {
  const team = useTeam()
  const filters = useTaskFilters()
  const session = useSession()
  watch(team.teamId, (id) => filters.forTeam(id), { immediate: true })

  /** The sprint shown, or 'all'. */
  const sprint = computed<WithId<Sprint> | 'all' | null>(() => {
    if (mine() || filters.sprint === 'current') return team.currentSprint.value
    if (filters.sprint === 'all') return 'all'
    return team.sprintById.value.get(filters.sprint) ?? team.currentSprint.value
  })

  const inSprint = computed(() => {
    const shown = sprint.value
    if (!shown) return []
    return shown === 'all'
      ? team.tasks.value.filter((task) => task.sprintId !== null)
      : team.tasksIn(shown.id)
  })

  function matches(task: Task): boolean {
    const uid = session.member?.id ?? ''
    if (mine()) return task.assigneeIds.includes(uid)
    if (filters.subteam !== 'all' && !task.subteamIds.includes(filters.subteam)) return false
    if (filters.assignee !== 'all' && !task.assigneeIds.includes(filters.assignee)) return false
    const query = filters.search.trim().toLowerCase()
    if (!query) return true
    const subteams = team.subteams.value
      .filter((s) => task.subteamIds.includes(s.id))
      .map((s) => s.name)
    const people = task.assigneeIds.map(team.nameOf)
    return [task.title, ...subteams, ...people].join(' ').toLowerCase().includes(query)
  }

  const visible = computed<WithId<Task>[]>(() => inSprint.value.filter(matches))
  const filtered = computed(
    () =>
      !mine() &&
      (filters.subteam !== 'all' || filters.assignee !== 'all' || !!filters.search.trim()),
  )
  return { team, filters, sprint, visible, filtered }
}
