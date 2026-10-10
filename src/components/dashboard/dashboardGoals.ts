// Shared state between Coaches' Dashboard → Goals and its team groups: totals for the summary line, and which teams
// are collapsed (kept in this browser).
import { computed, ref, shallowReactive, type InjectionKey, type Ref } from 'vue'

export interface GoalGroupHandle {
  needing: () => number
  students: () => number
}
export interface DashboardGoals {
  register(teamId: string, handle: GoalGroupHandle): void
  unregister(teamId: string): void
  collapsed: Ref<Set<string>>
  setCollapsed(teamId: string, collapsed: boolean): void
  needing: Readonly<Ref<number>>
  students: Readonly<Ref<number>>
}
export const DASHBOARD_GOALS: InjectionKey<DashboardGoals> = Symbol('dashboardGoals')
const STORAGE = 'switchback.collapsedGoalTeams'

export function createDashboardGoals(): DashboardGoals {
  const groups = shallowReactive(new Map<string, GoalGroupHandle>())
  const collapsed = ref<Set<string>>(new Set())
  try {
    collapsed.value = new Set(JSON.parse(localStorage.getItem(STORAGE) ?? '[]') as string[])
  } catch {
    // Storage can be unavailable; every team starts open.
  }
  return {
    register: (teamId, handle) => groups.set(teamId, handle),
    unregister: (teamId) => groups.delete(teamId),
    collapsed,
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
    // Plain numbers, so the page re-renders only when a total really changes.
    needing: computed(() => [...groups.values()].reduce((sum, g) => sum + g.needing(), 0)),
    students: computed(() => [...groups.values()].reduce((sum, g) => sum + g.students(), 0)),
  }
}
