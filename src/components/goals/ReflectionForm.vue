<script setup lang="ts">
// "Got it": three quick questions that go into goal history, then the goal is finished.
import { onMounted, reactive, ref } from 'vue'
import { useGoalActions } from '@/composables/useGoalActions'
import type { GoalDoc } from '@/composables/useGoals'
import { useGoalFlow } from '@/stores/goalFlow'

const props = defineProps<{ goal: GoalDoc }>()
const flow = useGoalFlow()
const actions = useGoalActions()
const answers = reactive({ helped: '', different: '', next: '' })
const first = ref<HTMLInputElement | null>(null)
onMounted(() => first.value?.focus())

function finish() {
  actions.finish(props.goal, {
    helped: answers.helped.trim(),
    different: answers.different.trim(),
    next: answers.next.trim(),
  })
  flow.replace({ kind: 'finished' })
}
</script>

<template>
  <div class="goal-modal-head celebrate"><p class="goal-kicker">🎉 You got it!</p></div>
  <h2>Wrap up your goal</h2>
  <p class="goal-lead">Three quick questions. Your answers go into your goal history.</p>
  <div class="checkin-form">
    <label class="field"
      >What helped most?
      <input ref="first" v-model="answers.helped" class="goal-line" maxlength="140"
    /></label>
    <label class="field"
      >What would you do differently?
      <input v-model="answers.different" class="goal-line" maxlength="140"
    /></label>
    <label class="field"
      >What might you learn next? <input v-model="answers.next" class="goal-line" maxlength="140"
    /></label>
  </div>
  <div class="goal-modal-actions">
    <button type="button" class="goal-button" @click="flow.close()">Cancel</button>
    <button type="button" class="goal-button primary" @click="finish">Finish goal</button>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: 6px;
  color: #2c343b;
  font-size: 14px;
  font-weight: 650;
}
</style>
