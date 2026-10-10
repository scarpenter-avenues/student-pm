<script setup lang="ts">
// "<Team> goals": one card per student with their active goals' statement and status. Students see only that
// (from the team-readable summaries). Mentors and coaches also see "Checked in …" and what needs attention, and
// open a student's card to review.
import { computed } from 'vue'
import { queries, useLiveQuery } from '@/data'
import { todayIso } from '@/model/dates'
import { checkinWindow, coachNeeds, goalFlags, type Flag } from '@/model/goals'
import { ADULT_ROLES, type GoalStatus } from '@/model/types'
import { goalLike } from '@/composables/useGoals'
import { useTeam } from '@/composables/useTeamData'
import { useSession } from '@/stores/session'
import { formatShortDate, initials } from '@/ui/format'
import GoalStatusPill from './GoalStatusPill.vue'

const emit = defineEmits<{ open: [studentId: string] }>()
const team = useTeam()
const session = useSession()
const adult = computed(() => session.isAdult)

const summaries = useLiveQuery(() => team.teamId.value && queries.teamGoalCards(team.teamId.value))
const goals = useLiveQuery(
  () => adult.value && team.teamId.value && queries.teamGoals([team.teamId.value]),
)
const students = computed(() =>
  team.members.value.filter(
    (member) =>
      member.teamIds.includes(team.teamId.value ?? '') && !ADULT_ROLES.includes(member.role),
  ),
)
const window = computed(() => checkinWindow(team.sprints.value, todayIso()))

function relative(iso: string) {
  const days = Math.round((Date.parse(todayIso()) - Date.parse(iso)) / 86_400_000)
  return days === 0
    ? 'today'
    : days === 1
      ? 'yesterday'
      : days < 7
        ? `${days} days ago`
        : formatShortDate(iso)
}
const cards = computed(() =>
  students.value.map((student) => {
    const active = summaries.data.value.filter((summary) => summary.studentId === student.id)
    const own = goals.data.value.filter((goal) => goal.studentId === student.id)
    const rows = own.filter((goal) => goal.state === 'active')
    const flags: Flag[] = adult.value
      ? rows.length
        ? rows.flatMap((goal) => goalFlags(goalLike(goal), window.value, todayIso()))
        : goalFlags(null, null, todayIso(), {
            paused: own.filter((goal) => goal.state === 'paused').length,
          })
      : []
    return {
      student,
      goals: active.map((summary) => {
        const goal = own.find((g) => g.id === summary.id)
        return {
          id: summary.id,
          statement: summary.statement,
          status: summary.status as GoalStatus,
          checked: goal
            ? goal.lastCheckinAt
              ? `Checked in ${relative(goal.lastCheckinAt)}`
              : 'No check-ins yet'
            : '',
        }
      }),
      needs: coachNeeds(flags).filter(([text]) => text !== 'No goal yet'),
    }
  }),
)
</script>

<template>
  <section class="team-goals">
    <div class="goal-section-head">
      <h3>{{ team.team.value?.name }} goals</h3>
    </div>
    <div class="grid">
      <component
        :is="adult ? 'button' : 'article'"
        v-for="card in cards"
        :key="card.student.id"
        class="card"
        :type="adult ? 'button' : undefined"
        :title="adult ? 'Review goals' : undefined"
        @click="adult && emit('open', card.student.id)"
      >
        <div class="who">
          <span class="avatar">{{ initials(card.student.displayName) }}</span>
          <strong
            >{{ card.student.displayName
            }}{{ card.student.id === session.member?.id ? ' (you)' : '' }}</strong
          >
        </div>
        <p v-if="!card.goals.length" class="muted">No goal yet</p>
        <template v-for="goal in card.goals" :key="goal.id">
          <p>{{ goal.statement }}</p>
          <div class="goal-meta">
            <GoalStatusPill :status="goal.status" />
            <span v-if="adult && goal.checked">{{ goal.checked }}</span>
          </div>
        </template>
        <div v-if="card.needs.length" class="goal-meta">
          <span v-for="[text, tone] in card.needs" :key="text" :class="`review-flag ${tone}`">{{
            text
          }}</span>
        </div>
      </component>
    </div>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
}
.card {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: inherit;
  font: inherit;
  text-align: left;
}
button.card:hover {
  border-color: var(--team-line);
}
.card p {
  margin: 0;
  color: #2c343b;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}
.card p.muted {
  color: #9aa3aa;
  font-weight: 500;
}
.who {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.avatar {
  display: inline-grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  background: #e2ece6;
  color: #27654f;
  font-size: 9px;
  font-weight: 800;
}
</style>
