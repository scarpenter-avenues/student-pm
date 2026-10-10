<script setup lang="ts">
// A student's goals, for their coaches: each current goal (statement, status, date, the private plan) with its full
// timeline and "+ Leave feedback", paused goals, and past goals. Mentors see the goals on their teams; program
// coaches see every goal the student has had.
import { computed, ref } from 'vue'
import { queries, useLiveQuery } from '@/data'
import { todayIso } from '@/model/dates'
import { byLabel, datePassed } from '@/model/goals'
import { goalStatement } from '@/model/types'
import { goalCreated, type GoalDoc } from '@/composables/useGoals'
import { useNames } from '@/composables/useNames'
import { useTeam } from '@/composables/useTeamData'
import { useSession } from '@/stores/session'
import { formatShortDate } from '@/ui/format'
import GoalHistoryList from './GoalHistoryList.vue'
import GoalStatusPill from './GoalStatusPill.vue'
import GoalTimeline from './GoalTimeline.vue'
import PausedGoals from './PausedGoals.vue'

const props = defineProps<{ studentId: string; backLabel: string }>()
const emit = defineEmits<{ back: [] }>()
const session = useSession()
const team = useTeam()
const { nameOf } = useNames(team)
const name = computed(() => nameOf(props.studentId))
const possessive = computed(() => (name.value.endsWith('s') ? `${name.value}'` : `${name.value}'s`))

const list = useLiveQuery(() =>
  session.isCoach
    ? queries.studentGoals(props.studentId)
    : queries.teamGoals(session.member?.teamIds ?? []),
)
const goals = computed<GoalDoc[]>(() =>
  list.data.value
    .filter((goal) => goal.studentId === props.studentId)
    .sort((a, b) => goalCreated(b).localeCompare(goalCreated(a))),
)
const active = computed(() => goals.value.filter((goal) => goal.state === 'active'))
const paused = computed(() => goals.value.filter((goal) => goal.state === 'paused'))
const past = computed(() =>
  goals.value.filter((goal) => goal.state === 'done' || goal.state === 'changed'),
)
const timelines = ref<Record<string, InstanceType<typeof GoalTimeline> | null>>({})
</script>

<template>
  <div class="detail">
    <button type="button" class="text-button back" @click="emit('back')">{{ backLabel }}</button>
    <h2>{{ possessive }} goals</h2>
    <section class="current">
      <div class="goal-section-head">
        <h3>{{ active.length > 1 ? `Current goals (${active.length})` : 'Current goal' }}</h3>
      </div>
      <div v-for="goal in active" :key="goal.id" class="goal-block">
        <p class="statement">{{ goalStatement(goal.wish) }}</p>
        <div class="goal-meta">
          <GoalStatusPill :status="goal.status" />
          <span>By {{ byLabel(goal.by, formatShortDate) }}</span>
          <span v-if="datePassed(goal, todayIso())" class="review-flag warn">Date passed</span>
          <span>{{
            goal.lastCheckinAt
              ? `Last check-in ${formatShortDate(goal.lastCheckinAt)}`
              : 'No check-ins yet'
          }}</span>
        </div>
        <p class="privacy">🔒 Private to the student and coaches.</p>
        <dl class="goal-private">
          <dt>I'll know I've got it when</dt>
          <dd>{{ goal.evidence }}</dd>
          <dt>What might get in the way</dt>
          <dd>{{ goal.obstacle }}</dd>
          <dt>My if-then plan</dt>
          <dd>{{ goal.plan }}</dd>
        </dl>
        <GoalTimeline
          :ref="(el) => (timelines[goal.id] = el as InstanceType<typeof GoalTimeline> | null)"
          :goal="goal"
        />
        <button
          type="button"
          class="goal-button feedback"
          @click="timelines[goal.id]?.startFeedback('general')"
        >
          ＋ Leave feedback on this goal
        </button>
      </div>
      <p v-if="!active.length && !list.loading.value" class="goal-more">
        {{
          paused.length
            ? `${name} has paused ${paused.length === 1 ? 'their goal' : 'their goals'}. A quick conversation at build night can help pick one back up or set a new one.`
            : `${name} hasn't set a goal yet. A quick conversation at build night usually helps.`
        }}
      </p>
      <PausedGoals v-if="paused.length" :goals="paused" :owner="false" />
    </section>
    <GoalHistoryList :goals="past" :title="`Past goals (${past.length})`" />
  </div>
</template>

<style scoped>
.back {
  margin-bottom: 8px;
  padding-left: 0;
  font-size: 13px;
}
h2 {
  margin: 0 0 14px;
  font-size: 20px;
}
.current {
  margin-bottom: 26px;
}
.goal-block {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.statement {
  margin: 0 0 6px;
  color: #202124;
  font-size: 17px;
  font-weight: 700;
}
.privacy {
  margin: 10px 0 6px;
  color: #8a949c;
  font-size: 12px;
}
.feedback {
  margin-top: 10px;
}
</style>
