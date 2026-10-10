<script setup lang="ts">
// The arrival reminder: every active goal's needs in one place (passed dates, due check-ins, new feedback), or a
// nudge to set (or resume) a goal. "Start" runs the steps in a queue, date decisions before check-ins. Later hides
// it for this browser session.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { byLabel } from '@/model/goals'
import { todayIso } from '@/model/dates'
import { goalStatement } from '@/model/types'
import type { GoalDoc, GoalNeeds } from '@/composables/useGoals'
import { useGoalActions } from '@/composables/useGoalActions'
import { useTeam } from '@/composables/useTeamData'
import { useGoalFlow, type GoalStep } from '@/stores/goalFlow'
import { formatEventDate, formatShortDate, plural } from '@/ui/format'

const props = defineProps<{
  needs: readonly GoalNeeds[]
  active: readonly GoalDoc[]
  paused: readonly GoalDoc[]
  finishedBefore: boolean
}>()
const emit = defineEmits<{ later: [] }>()

const flow = useGoalFlow()
const router = useRouter()
const team = useTeam()
const actions = useGoalActions()

const steps = computed<GoalStep[]>(() =>
  props.needs.flatMap(({ goal, due, passed }) => [
    ...(passed ? [{ kind: 'datePassed' as const, goalId: goal.id }] : []),
    ...(due ? [{ kind: 'checkin' as const, goalId: goal.id }] : []),
  ]),
)
const dueCount = computed(() => props.needs.filter((need) => need.due).length)
const title = computed(() => {
  if (!steps.value.length) return 'New feedback on your goal'
  if (dueCount.value > 1) return 'Time for your goal check-ins'
  return dueCount.value ? 'Time for your goal check-in' : 'Your goal date passed'
})
const goLabel = computed(() =>
  steps.value.length
    ? steps.value.length > 1
      ? `Start (${steps.value.length} steps)`
      : dueCount.value
        ? 'Check in now'
        : 'Decide now'
    : 'View feedback',
)
/** One short paragraph per goal: what's due, then any new feedback. */
function sentence({ goal, due, passed, unread }: GoalNeeds) {
  const parts: string[] = []
  if (passed)
    parts.push(
      `You were aiming for ${byLabel(goal.by, formatShortDate)}. Keep going, finish it, or change it.`,
    )
  if (due)
    parts.push(
      due.overdue
        ? `Your ${due.sprint.name} check-in is due. It takes about a minute.`
        : `${due.sprint.name} ends ${formatEventDate(due.sprint.end)}. Checking in takes about a minute.`,
    )
  if (unread) {
    const also = parts.length ? ' also' : ''
    parts.push(
      unread === 1
        ? `A coach${also} commented on this goal.`
        : `Your coaches${also} left ${unread} new comments.`,
    )
  }
  return parts.join(' ')
}
function goToGoals() {
  if (team.teamId.value)
    void router.push({ name: 'team', params: { teamId: team.teamId.value, tab: 'goals' } })
}
function go() {
  goToGoals()
  if (steps.value.length) flow.run(steps.value)
  else flow.close()
}
function setGoal() {
  goToGoals()
  flow.open({ kind: 'wizard' })
}
function resume() {
  goToGoals()
  flow.close()
  const goal = props.paused[0]
  if (
    goal &&
    actions.resume(goal, props.active.length) &&
    goal.by.date &&
    goal.by.date < todayIso()
  )
    flow.open({ kind: 'wizard', goalId: goal.id, startAt: 'by' })
}
</script>

<template>
  <template v-if="!active.length">
    <h2>{{ paused.length ? 'Your goal is paused' : 'Set your learning goal' }}</h2>
    <p class="goal-lead">
      <template v-if="paused.length">
        “{{ goalStatement(paused[0]!.wish) }}”<template v-if="paused.length > 1">
          and {{ plural(paused.length - 1, 'other goal') }} are</template
        ><template v-else> is</template> paused. Pick it back up, or set a new goal.
      </template>
      <template v-else-if="finishedBefore">
        Nice work finishing your last goal. Pick what you want to learn next.
      </template>
      <template v-else>
        Pick one thing you want to learn this season. You'll check in for about a minute at the end
        of each sprint.
      </template>
    </p>
    <div class="goal-modal-actions">
      <button type="button" class="goal-button" @click="emit('later')">Later</button>
      <button v-if="paused.length === 1" type="button" class="goal-button" @click="resume">
        Resume it
      </button>
      <button
        v-else-if="paused.length"
        type="button"
        class="goal-button"
        @click="(goToGoals(), flow.close())"
      >
        See paused goals
      </button>
      <button type="button" class="goal-button primary" @click="setGoal">
        {{ paused.length ? 'Set a new goal' : 'Set my goal' }}
      </button>
    </div>
  </template>
  <template v-else>
    <h2>{{ title }}</h2>
    <template v-for="need in needs" :key="need.goal.id">
      <p class="statement">{{ goalStatement(need.goal.wish) }}</p>
      <p class="need">{{ sentence(need) }}</p>
    </template>
    <div class="goal-modal-actions">
      <button type="button" class="goal-button" @click="emit('later')">Later</button>
      <button type="button" class="goal-button primary" @click="go">{{ goLabel }}</button>
    </div>
  </template>
</template>

<style scoped>
.statement {
  margin: 12px 0 2px;
  color: #202124;
  font-size: 15px;
  font-weight: 700;
}
.need {
  margin: 0;
  color: #3f474e;
  font-size: 14px;
}
</style>
