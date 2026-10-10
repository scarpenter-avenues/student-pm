<script setup lang="ts">
// Shows the open goal pop-up (see stores/goalFlow), and the arrival reminder for students: once per page load, unless
// "Later" was picked in this browser session. Esc or a click outside closes (and drops any queued steps).
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMyGoals, needsOf, needsAttention } from '@/composables/useGoals'
import { useTeam } from '@/composables/useTeamData'
import { useGoalFlow } from '@/stores/goalFlow'
import { useSession } from '@/stores/session'
import CheckinForm from './CheckinForm.vue'
import DatePassed from './DatePassed.vue'
import GoalFinished from './GoalFinished.vue'
import GoalPrompt from './GoalPrompt.vue'
import GoalWizard from './GoalWizard.vue'
import PauseForm from './PauseForm.vue'
import ReflectionForm from './ReflectionForm.vue'

const flow = useGoalFlow()
const session = useSession()
const team = useTeam()
const route = useRoute()
const { goals, active, paused, past, loading } = useMyGoals()

const step = computed(() => flow.current)
const goalOf = (id: string | undefined) =>
  id ? (goals.value.find((goal) => goal.id === id) ?? null) : null
const stepGoal = computed(() => {
  const s = step.value
  return s && 'goalId' in s ? goalOf(s.goalId) : null
})
const label = computed(
  () =>
    ({
      wizard: 'Set my goal',
      checkin: 'Goal check-in',
      reflection: 'Goal reflection',
      finished: 'Goal finished',
      pause: 'Pause goal',
      datePassed: 'Goal date passed',
      prompt: 'Goal reminder',
    })[step.value?.kind ?? 'prompt'],
)

// ---------- arrival reminder ----------
const needs = computed(() =>
  active.value.map((goal) => needsOf(goal, team.sprints.value)).filter(needsAttention),
)
const KEY = () => `switchback.goalPromptLater.${session.member?.id ?? ''}`
function snoozed() {
  try {
    return sessionStorage.getItem(KEY()) === '1'
  } catch {
    return false
  }
}
const prompted = ref(false)
watch(
  () => [loading.value, team.sprints.value.length, route.name, session.role] as const,
  ([isLoading, sprintCount, routeName, role]) => {
    if (prompted.value || isLoading || !sprintCount || !role || routeName !== 'team') return
    if (role !== 'student' && role !== 'lead') return
    prompted.value = true
    if (snoozed() || flow.current) return
    if (!active.value.length || needs.value.length) flow.open({ kind: 'prompt' })
  },
  { immediate: true },
)
function later() {
  try {
    sessionStorage.setItem(KEY(), '1')
  } catch {
    // Private windows can refuse storage; the reminder just comes back next time.
  }
  flow.close()
}

const wizardGoal = computed(() =>
  step.value?.kind === 'wizard' ? goalOf(step.value.goalId) : null,
)
const replaces = computed(() =>
  step.value?.kind === 'wizard' ? goalOf(step.value.replaces) : null,
)
const needsGoal = computed(
  () => step.value && 'goalId' in step.value && step.value.kind !== 'wizard',
)
// A goal that vanished (e.g. finished in another tab) skips its step.
watch(
  () => [step.value, stepGoal.value, loading.value] as const,
  ([s, g, isLoading]) => {
    if (s && needsGoal.value && !isLoading && !g) flow.next()
  },
)
</script>

<template>
  <div
    v-if="step && (!needsGoal || stepGoal)"
    class="goal-modal-overlay"
    @click.self="flow.close()"
    @keydown.esc="flow.close()"
  >
    <div class="goal-modal" role="dialog" aria-modal="true" :aria-label="label">
      <GoalWizard
        v-if="step.kind === 'wizard'"
        :key="`${step.goalId ?? 'new'}-${step.startAt ?? ''}-${step.replaces ?? ''}`"
        :goal="wizardGoal"
        :active="active"
        :start-at="step.startAt"
        :replaces="replaces"
      />
      <CheckinForm
        v-else-if="step.kind === 'checkin' && stepGoal"
        :key="stepGoal.id"
        :goal="stepGoal"
      />
      <ReflectionForm v-else-if="step.kind === 'reflection' && stepGoal" :goal="stepGoal" />
      <PauseForm v-else-if="step.kind === 'pause' && stepGoal" :goal="stepGoal" />
      <DatePassed v-else-if="step.kind === 'datePassed' && stepGoal" :goal="stepGoal" />
      <GoalFinished v-else-if="step.kind === 'finished'" :active-count="active.length" />
      <GoalPrompt
        v-else-if="step.kind === 'prompt'"
        :needs="needs"
        :active="active"
        :paused="paused"
        :finished-before="past.some((goal) => goal.state === 'done')"
        @later="later"
      />
    </div>
  </div>
</template>
