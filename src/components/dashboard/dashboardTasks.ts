// Shared state between the Coaches' Dashboard → Tasks page and its team groups: selection across teams (keys are
// "teamId::taskKey") and which teams are collapsed (kept in this browser).
import { computed, ref, shallowReactive, type InjectionKey, type Ref } from 'vue'
import type { TeamData } from '@/composables/useTeamData'

export interface GroupHandle {
  data: TeamData
  keys: () => string[]
  count: () => number
}
export interface DashboardTasks {
  register(teamId: string, handle: GroupHandle): void
  unregister(teamId: string): void
  has(teamId: string, key: string): boolean
  toggle(teamId: string, key: string, event?: MouseEvent): void
  clear(): void
  selected: Ref<Set<string>>
  groups: Map<string, GroupHandle>
  collapsed: Ref<Set<string>>
  setCollapsed(teamId: string, collapsed: boolean): void
}
export const DASHBOARD_TASKS: InjectionKey<DashboardTasks> = Symbol('dashboardTasks')

const STORAGE = 'switchback.collapsedTaskTeams'

export function createDashboardTasks(order: () => string[]): DashboardTasks {
  const groups = shallowReactive(new Map<string, GroupHandle>())
  const selected = ref<Set<string>>(new Set())
  let anchor: string | null = null
  const collapsed = ref<Set<string>>(new Set())
  try {
    collapsed.value = new Set(JSON.parse(localStorage.getItem(STORAGE) ?? '[]') as string[])
  } catch {
    // Storage can be unavailable (private windows); every team starts open.
  }
  const allKeys = () =>
    order().flatMap(
      (teamId) =>
        groups
          .get(teamId)
          ?.keys()
          .map((key) => `${teamId}::${key}`) ?? [],
    )

  return {
    groups,
    selected,
    collapsed,
    register: (teamId, handle) => groups.set(teamId, handle),
    unregister: (teamId) => groups.delete(teamId),
    has: (teamId, key) => selected.value.has(`${teamId}::${key}`),
    toggle(teamId, key, event) {
      const full = `${teamId}::${key}`
      const next = new Set(selected.value)
      if (event?.shiftKey && anchor) {
        const keys = allKeys()
        const [a, b] = [keys.indexOf(anchor), keys.indexOf(full)].sort((x, y) => x - y)
        if (a !== undefined && b !== undefined && a >= 0)
          keys.slice(a, b + 1).forEach((k) => next.add(k))
      } else if (next.has(full)) next.delete(full)
      else next.add(full)
      anchor = full
      selected.value = next
    },
    clear() {
      selected.value = new Set()
      anchor = null
    },
    setCollapsed(teamId, isCollapsed) {
      const next = new Set(collapsed.value)
      if (isCollapsed) next.add(teamId)
      else next.delete(teamId)
      collapsed.value = next
      try {
        localStorage.setItem(STORAGE, JSON.stringify([...next]))
      } catch {
        // Not remembered; fine.
      }
    },
  }
}

export const totalOf = (tasks: DashboardTasks) =>
  computed(() => [...tasks.groups.values()].reduce((sum, g) => sum + g.count(), 0))
