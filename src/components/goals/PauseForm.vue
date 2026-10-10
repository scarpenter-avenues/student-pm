<script setup lang="ts">
// Pause a goal: it skips check-ins and drops off the team's goal cards until resumed. Reasons are tap-only.
import { ref } from 'vue'
import { PAUSE_REASONS } from '@/model/goals'
import { goalStatement } from '@/model/types'
import { useGoalActions } from '@/composables/useGoalActions'
import type { GoalDoc } from '@/composables/useGoals'
import { useGoalFlow } from '@/stores/goalFlow'

const props = defineProps<{ goal: GoalDoc }>()
const flow = useGoalFlow()
const actions = useGoalActions()
const reason = ref<string | null>(null)
function pause() {
  actions.pause(props.goal, reason.value)
  flow.next()
}
</script>

<template>
  <p class="goal-kicker">Pause goal</p>
  <h2>{{ goalStatement(goal.wish) }}</h2>
  <p class="goal-lead">
    Paused goals skip check-ins and your team won't see it for now. Your plan, check-ins, and
    feedback are kept, and you can pick it back up any time.
  </p>
  <p class="goal-ideas-label">Why are you pausing? (optional)</p>
  <div class="choice-row">
    <button
      v-for="text in PAUSE_REASONS"
      :key="text"
      type="button"
      class="choice"
      :aria-pressed="reason === text"
      @click="reason = reason === text ? null : text"
    >
      {{ text }}
    </button>
  </div>
  <div class="goal-modal-actions">
    <button type="button" class="goal-button" @click="flow.close()">Cancel</button>
    <button type="button" class="goal-button primary" @click="pause">Pause goal</button>
  </div>
</template>
