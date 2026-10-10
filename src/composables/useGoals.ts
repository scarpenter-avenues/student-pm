// Goals, live. A student's own goals (useMyGoals) and what each needs right now (check-in due, date passed, new
// feedback), worked out against the sprints of the goal's team.
import { computed } from 'vue'
import { queries, refs, useLiveQuery } from '@/data'
import { localIso, todayIso } from '@/model/dates'
import {
  checkinDue,
  checkinWindow,
  datePassed,
  type CheckinWindow,
  type GoalLike,
} from '@/model/goals'
import type { Goal, Sprint, WithId } from '@/model/types'
import { useSession } from '@/stores/session'

export type GoalDoc = WithId<Goal>

/** The calendar date a goal was set. */
export function goalCreated(goal: Goal): string {
  return goal.createdAt ? localIso(goal.createdAt.toDate()) : todayIso()
}

export function goalLike(goal: Goal): GoalLike {
  return {
    state: goal.state,
    status: goal.status,
    by: goal.by,
    created: goalCreated(goal),
    lastCheckinAt: goal.lastCheckinAt,
    lastFeedbackAt: goal.lastFeedbackAt ?? null,
    unreadFeedback: goal.unreadFeedback,
  }
}

export interface GoalNeeds {
  goal: GoalDoc
  due: CheckinWindow | null
  passed: boolean
  unread: number
}

/** What each goal needs, given its team's sprints (in order). */
export function needsOf(goal: GoalDoc, sprints: readonly Sprint[], today = todayIso()): GoalNeeds {
  const window = checkinWindow(sprints, today)
  return {
    goal,
    due: checkinDue(goalLike(goal), window),
    passed: datePassed(goal, today),
    unread: goal.state === 'active' ? goal.unreadFeedback : 0,
  }
}
export const needsAttention = (needs: GoalNeeds) => !!needs.due || needs.passed || needs.unread > 0

/** The signed-in student's goals (every team and season: goals follow the student). */
export function useMyGoals() {
  const session = useSession()
  const list = useLiveQuery(() => session.member && queries.myGoals(session.member.id))
  const goals = computed(() =>
    [...list.data.value].sort((a, b) => goalCreated(b).localeCompare(goalCreated(a))),
  )
  return {
    goals,
    loading: list.loading,
    active: computed(() => goals.value.filter((goal) => goal.state === 'active')),
    paused: computed(() => goals.value.filter((goal) => goal.state === 'paused')),
    past: computed(() =>
      goals.value.filter((goal) => goal.state === 'done' || goal.state === 'changed'),
    ),
  }
}

/** Seasons by id, for "2026–27 season" headings in goal history. */
export function useSeasons() {
  const list = useLiveQuery(() => refs.seasons())
  return computed(() => new Map(list.data.value.map((season) => [season.id, season])))
}
