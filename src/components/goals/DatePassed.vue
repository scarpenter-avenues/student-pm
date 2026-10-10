<script setup lang="ts">
// A goal's "by" date has passed: keep going (new date), I got it (wrap up), change my goal, or pause it.
import { byLabel } from '@/model/goals'
import { goalStatement } from '@/model/types'
import type { GoalDoc } from '@/composables/useGoals'
import { useGoalFlow } from '@/stores/goalFlow'
import { formatShortDate } from '@/ui/format'

const props = defineProps<{ goal: GoalDoc }>()
const flow = useGoalFlow()
const id = props.goal.id
</script>

<template>
  <p class="goal-kicker">Goal date passed</p>
  <h2>{{ goalStatement(goal.wish) }}</h2>
  <p class="goal-lead">
    You were aiming for {{ byLabel(goal.by, formatShortDate) }}. That's OK. Most goals take longer
    than planned. What's next?
  </p>
  <div class="options">
    <button
      type="button"
      class="option"
      @click="flow.replace({ kind: 'wizard', goalId: id, startAt: 'by' })"
    >
      <strong>Keep going</strong><span>Pick a new date and keep working on it.</span>
    </button>
    <button type="button" class="option" @click="flow.replace({ kind: 'reflection', goalId: id })">
      <strong>I got it</strong><span>Finish the goal with three quick reflection questions.</span>
    </button>
    <button type="button" class="option" @click="flow.replace({ kind: 'wizard', replaces: id })">
      <strong>Change my goal</strong
      ><span>Set a different goal. This one moves to your history.</span>
    </button>
    <button type="button" class="option" @click="flow.replace({ kind: 'pause', goalId: id })">
      <strong>Pause it</strong><span>Come back to it later in the season.</span>
    </button>
  </div>
  <div class="goal-modal-actions">
    <button type="button" class="goal-button" @click="flow.close()">Later</button>
  </div>
</template>

<style scoped>
.options {
  display: grid;
  gap: 8px;
}
.option {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  text-align: left;
}
.option strong {
  color: #202124;
  font-size: 15px;
}
.option span {
  color: #66717a;
  font-size: 13px;
}
.option:hover,
.option:focus-visible {
  border-color: var(--team-line);
  background: var(--team-softer);
}
</style>
