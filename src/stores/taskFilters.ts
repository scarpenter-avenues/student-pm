// The task filters Board, List, and Timeline share (My Tasks ignores them). They reset when you switch teams.
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTaskFilters = defineStore('taskFilters', () => {
  const teamId = ref<string | null>(null)
  /** 'current', 'all', or a sprint id. */
  const sprint = ref<string>('current')
  const subteam = ref<string>('all')
  const assignee = ref<string>('all')
  const search = ref('')

  function forTeam(id: string | null) {
    if (id === teamId.value) return
    teamId.value = id
    sprint.value = 'current'
    subteam.value = 'all'
    assignee.value = 'all'
    search.value = ''
  }
  return { teamId, sprint, subteam, assignee, search, forTeam }
})
