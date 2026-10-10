<script setup lang="ts">
// The student's own goal: check-in / date-passed banner, title + status + ⋯ (Check in, Edit goal, Pause goal), the
// date line, My plan (private), then the latest check-in and coach feedback, with the rest behind
// "Show full history (N)". With several goals, collapsed cards show the title, status, a flag, and the date line.
import { computed, ref } from 'vue'
import { daysBetween, todayIso } from '@/model/dates'
import { byLabel } from '@/model/goals'
import { goalStatement } from '@/model/types'
import { needsOf, type GoalDoc } from '@/composables/useGoals'
import { useTeam } from '@/composables/useTeamData'
import { useGoalFlow } from '@/stores/goalFlow'
import { formatEventDate, formatShortDate } from '@/ui/format'
import ChoiceMenu from '@/components/ui/ChoiceMenu.vue'
import GoalStatusPill from './GoalStatusPill.vue'
import GoalTimeline from './GoalTimeline.vue'

const props = defineProps<{ goal: GoalDoc; collapsible: boolean; open: boolean }>()
const emit = defineEmits<{ toggle: [] }>()

const team = useTeam()
const flow = useGoalFlow()
const needs = computed(() => needsOf(props.goal, team.sprints.value))
const shown = computed(() => !props.collapsible || props.open)
const flag = computed(() =>
  needs.value.due
    ? 'Check-in due'
    : needs.value.unread
      ? 'New feedback'
      : needs.value.passed
        ? 'Needs a decision'
        : '',
)
const dateLine = computed(() => {
  const by = props.goal.by
  const away =
    by.date && by.date >= todayIso() ? ` (in ${daysBetween(todayIso(), by.date)} days)` : ''
  const last = props.goal.lastCheckinAt
    ? `Last check-in ${formatShortDate(props.goal.lastCheckinAt)}`
    : 'No check-ins yet'
  return `By ${byLabel(by, formatShortDate)}${away} · ${last}`
})

const moreButton = ref<HTMLButtonElement | null>(null)
const menuOpen = ref(false)
const menuOptions = computed(() => [
  ...(needs.value.due ? [] : [{ value: 'checkin', label: 'Check in' }]),
  { value: 'edit', label: 'Edit goal' },
  { value: 'pause', label: 'Pause goal' },
])
function pick(action: string) {
  const goalId = props.goal.id
  if (action === 'checkin') flow.open({ kind: 'checkin', goalId })
  else if (action === 'edit') flow.open({ kind: 'wizard', goalId })
  else flow.open({ kind: 'pause', goalId })
}
const history = ref(false)
const timeline = ref<InstanceType<typeof GoalTimeline> | null>(null)
</script>

<template>
  <article class="my-goal-card" :class="{ collapsed: !shown }">
    <template v-if="shown">
      <div v-if="needs.passed" class="due-banner">
        <span>You were aiming for {{ byLabel(goal.by, formatShortDate) }}. What's next?</span>
        <button
          type="button"
          class="goal-button primary"
          @click="flow.open({ kind: 'datePassed', goalId: goal.id })"
        >
          Decide
        </button>
      </div>
      <div v-if="needs.due" class="due-banner">
        <span>
          {{
            needs.due.overdue
              ? `Your ${needs.due.sprint.name} check-in is waiting.`
              : `Check in before ${needs.due.sprint.name} ends ${formatEventDate(needs.due.sprint.end)}.`
          }}
        </span>
        <button
          type="button"
          class="goal-button primary"
          @click="flow.open({ kind: 'checkin', goalId: goal.id })"
        >
          Check in now
        </button>
      </div>
    </template>
    <div class="top">
      <div class="heading">
        <button
          v-if="collapsible"
          type="button"
          class="title"
          :aria-expanded="shown"
          @click="emit('toggle')"
        >
          {{ goalStatement(goal.wish) }}
        </button>
        <h4 v-else class="title">{{ goalStatement(goal.wish) }}</h4>
        <GoalStatusPill :status="goal.status" />
        <span v-if="needs.passed" class="review-flag warn">Date passed</span>
        <span v-if="!shown && flag" class="review-flag warn">{{ flag }}</span>
      </div>
      <button
        ref="moreButton"
        type="button"
        class="more"
        :aria-label="`More actions for ${goalStatement(goal.wish)}`"
        aria-haspopup="menu"
        aria-expanded="false"
        @click="menuOpen = !menuOpen"
      >
        ⋯
      </button>
      <ChoiceMenu
        v-if="menuOpen"
        :anchor="moreButton"
        align="right"
        :options="menuOptions"
        @pick="pick($event as string)"
        @close="menuOpen = false"
      />
    </div>
    <p class="meta">{{ dateLine }}</p>
    <template v-if="shown">
      <section class="plan">
        <h5>My plan <small>🔒 Only you and your coaches see this</small></h5>
        <div class="plan-grid">
          <div>
            <span>Done when</span>
            <p>{{ goal.evidence }}</p>
          </div>
          <div>
            <span>What might get in the way</span>
            <p>{{ goal.obstacle }}</p>
          </div>
          <div>
            <span>My if-then plan</span>
            <p>{{ goal.plan }}</p>
          </div>
        </div>
      </section>
      <section class="updates">
        <GoalTimeline ref="timeline" :goal="goal" latest />
        <button
          v-if="(timeline?.historyCount ?? 0) > 2"
          type="button"
          class="history-toggle"
          :aria-expanded="history"
          @click="history = !history"
        >
          {{ history ? 'Hide' : 'Show' }} full history ({{ timeline?.historyCount }})
        </button>
        <GoalTimeline v-if="history" :goal="goal" />
      </section>
    </template>
  </article>
</template>

<style scoped>
.my-goal-card {
  margin-bottom: 12px;
  padding: 16px 18px;
  border: 1px solid var(--team-line);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 0 0 3px var(--team-softer);
}
.my-goal-card.collapsed {
  padding-top: 12px;
  padding-bottom: 12px;
  box-shadow: none;
}
.due-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff4e5;
  color: #7a4b0c;
  font-size: 14px;
  font-weight: 600;
}
.top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  min-width: 0;
}
.title {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: #202124;
  font: inherit;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  text-align: left;
}
.collapsed .title {
  font-size: 16px;
}
.more {
  flex: 0 0 auto;
  width: 32px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #59636d;
  font-size: 18px;
  line-height: 1;
}
.more:hover,
.more[aria-expanded='true'] {
  border-color: var(--line);
  background: #f5f7fa;
}
.meta {
  margin: 4px 0 0;
  color: #66717a;
  font-size: 13px;
}
.plan {
  margin-top: 16px;
}
h5 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 8px;
  color: #4b5560;
  font-size: 12px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
h5 small {
  color: #8a949c;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}
.plan-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.plan-grid > div {
  padding: 10px 12px;
  border-radius: 8px;
  background: #f7f8fa;
}
.plan-grid span {
  color: #66717a;
  font-size: 12px;
  font-weight: 650;
}
.plan-grid p {
  margin: 4px 0 0;
  color: #202124;
  font-size: 14px;
  line-height: 1.45;
}
.updates {
  margin-top: 14px;
}
.updates :deep(.goal-timeline-wrap) {
  margin-top: 0;
}
.history-toggle {
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2864c7;
  font-size: 13px;
}
@media (max-width: 680px) {
  .plan-grid {
    grid-template-columns: 1fr;
  }
}
</style>
