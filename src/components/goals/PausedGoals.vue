<script setup lang="ts">
// Paused goals: kept out of check-ins and team cards; one tap to pick back up (the student), or the timeline (adults).
import { ref } from 'vue'
import { goalStatement } from '@/model/types'
import { localIso } from '@/model/dates'
import type { GoalDoc } from '@/composables/useGoals'
import { formatShortDate } from '@/ui/format'
import GoalTimeline from './GoalTimeline.vue'

const props = defineProps<{ goals: readonly GoalDoc[]; owner: boolean }>()
const emit = defineEmits<{ resume: [goal: GoalDoc] }>()
const open = ref(!props.owner)
const timelines = ref<Set<string>>(new Set())
function toggleTimeline(id: string) {
  const next = new Set(timelines.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  timelines.value = next
}
const pausedOn = (goal: GoalDoc) =>
  goal.pausedAt ? formatShortDate(localIso(goal.pausedAt.toDate())) : ''
</script>

<template>
  <section class="paused-goals">
    <button type="button" class="summary" :aria-expanded="open" @click="open = !open">
      <span aria-hidden="true">{{ open ? '▾' : '▸' }}</span> Paused goals ({{ goals.length }})
    </button>
    <template v-if="open">
      <div v-for="goal in goals" :key="goal.id" class="paused-goal">
        <div>
          <strong>{{ goalStatement(goal.wish) }}</strong>
          <p class="meta">Paused {{ pausedOn(goal) }} · was {{ goal.status }}</p>
        </div>
        <button v-if="owner" type="button" class="goal-button" @click="emit('resume', goal)">
          Resume
        </button>
        <button v-else type="button" class="text-button" @click="toggleTimeline(goal.id)">
          {{ timelines.has(goal.id) ? 'Hide timeline' : 'Show timeline' }}
        </button>
        <GoalTimeline v-if="timelines.has(goal.id)" class="full" :goal="goal" />
      </div>
    </template>
  </section>
</template>

<style scoped>
.paused-goals {
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.summary {
  padding: 0;
  border: 0;
  background: transparent;
  color: #4b5560;
  font-size: 13px;
  font-weight: 700;
}
.paused-goal {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 8px;
  padding: 9px 12px;
  border: 1px dashed #cfd6dd;
  border-radius: 8px;
  background: #f7f8fa;
}
.paused-goal strong {
  color: #4b5560;
  font-size: 14px;
}
.meta {
  margin: 2px 0 0;
  color: #737d86;
  font-size: 12px;
}
.paused-goal .goal-button {
  height: 30px;
  padding: 0 11px;
  font-size: 13px;
}
.full {
  flex-basis: 100%;
}
</style>
