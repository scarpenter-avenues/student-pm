<script setup lang="ts">
// The team's Goals tab. Students: "My goal" (or goals, up to 3; ＋ New goal; Past goals →; Paused goals) above the
// team's goal cards, where teammates see only statements and status. Opening it counts as reading new coach feedback.
// Mentors: the team's cards with what needs attention; a card opens the student's goals here. Program coaches review
// in the Coaches' Dashboard (cards open there).
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MAX_ACTIVE_GOALS, datePassed } from '@/model/goals'
import { todayIso } from '@/model/dates'
import { needsAttention, needsOf, useMyGoals } from '@/composables/useGoals'
import { useGoalActions } from '@/composables/useGoalActions'
import { useTeam } from '@/composables/useTeamData'
import { useGoalFlow } from '@/stores/goalFlow'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import GoalHistoryList from '@/components/goals/GoalHistoryList.vue'
import MyGoalCard from '@/components/goals/MyGoalCard.vue'
import PausedGoals from '@/components/goals/PausedGoals.vue'
import StudentGoalDetail from '@/components/goals/StudentGoalDetail.vue'
import TeamGoalCards from '@/components/goals/TeamGoalCards.vue'

const session = useSession()
const team = useTeam()
const router = useRouter()
const flow = useGoalFlow()
const toast = useToast()
const actions = useGoalActions()
const student = computed(() => !session.isAdult)
const { active, paused, past, goals } = useMyGoals()

// ---------- student ----------
const showHistory = ref(false)
const openCards = ref<Set<string>>(new Set())
let defaultedFor = ''
watch(
  () => active.value.map((goal) => goal.id).join(),
  (key) => {
    if (!key || key === defaultedFor) return
    defaultedFor = key
    // Open the first goal that needs attention (or the first), unless one is already open.
    if (!active.value.some((goal) => openCards.value.has(goal.id))) {
      const first =
        active.value.find((goal) => needsAttention(needsOf(goal, team.sprints.value))) ??
        active.value[0]
      if (first) openCards.value = new Set([...openCards.value, first.id])
    }
  },
  { immediate: true },
)
function toggleCard(id: string) {
  const next = new Set(openCards.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openCards.value = next
}
// Opening the page counts as reading new coach feedback (after the cards have had a moment to show "New").
watch(
  () =>
    active.value
      .filter((goal) => goal.unreadFeedback > 0)
      .map((goal) => goal.id)
      .join(),
  (ids) => {
    if (!ids || !student.value) return
    setTimeout(() => active.value.forEach((goal) => actions.markFeedbackRead(goal)), 4000)
  },
  { immediate: true },
)
function newGoal() {
  if (active.value.length >= MAX_ACTIVE_GOALS)
    return toast.show(
      `You can work on up to ${MAX_ACTIVE_GOALS} goals at once. Pause or finish one first.`,
    )
  flow.open({ kind: 'wizard' })
}
function resume(goalId: string) {
  const goal = goals.value.find((g) => g.id === goalId)
  if (!goal || !actions.resume(goal, active.value.length)) return
  if (datePassed({ ...goal, state: 'active' }, todayIso())) {
    toast.show('Goal resumed. Its date has passed, so pick a new one.')
    flow.open({ kind: 'wizard', goalId: goal.id, startAt: 'by' })
  } else toast.show('Goal resumed')
}

// ---------- adults ----------
const reviewing = ref<string | null>(null)
function openStudent(studentId: string) {
  if (session.isCoach)
    void router.push({ name: 'dashboard', params: { tab: 'goals' }, query: { student: studentId } })
  else reviewing.value = studentId
}
</script>

<template>
  <section class="goals-view">
    <!-- Student: goal history -->
    <template v-if="student && showHistory">
      <button type="button" class="text-button back" @click="showHistory = false">
        ← Back to goals
      </button>
      <h2>My goal history</h2>
      <p class="goal-more">Every goal, newest first. Goals stay with you when you change teams.</p>
      <GoalHistoryList :goals="goals" title="Timeline" />
    </template>

    <!-- Mentor: one student's goals -->
    <StudentGoalDetail
      v-else-if="!student && reviewing"
      :student-id="reviewing"
      back-label="← Back to goals"
      @back="reviewing = null"
    />

    <template v-else>
      <h2>Goals</h2>
      <section v-if="student" class="my-goal">
        <div class="goal-section-head">
          <h3>{{ active.length > 1 ? 'My goals' : 'My goal' }}</h3>
          <div class="head-actions">
            <button
              v-if="active.length && active.length < MAX_ACTIVE_GOALS"
              type="button"
              class="goal-button"
              @click="newGoal"
            >
              ＋ New goal
            </button>
            <button
              v-if="past.length"
              type="button"
              class="text-button"
              @click="showHistory = true"
            >
              Past goals ({{ past.length }}) →
            </button>
          </div>
        </div>
        <div v-if="!active.length" class="my-goal-card empty">
          <p>
            {{
              paused.length
                ? "You don't have an active goal right now. Pick a paused goal back up, or set a new one."
                : "Pick one thing you want to learn this season. Setting it up takes about 5 minutes, and you'll check in at the end of each sprint."
            }}
          </p>
          <button type="button" class="goal-button primary" @click="newGoal">
            {{ paused.length ? 'Set a new goal' : 'Set my goal' }}
          </button>
        </div>
        <MyGoalCard
          v-for="goal in active"
          :key="goal.id"
          :goal="goal"
          :collapsible="active.length > 1"
          :open="openCards.has(goal.id)"
          @toggle="toggleCard(goal.id)"
        />
        <PausedGoals v-if="paused.length" :goals="paused" owner @resume="resume($event.id)" />
      </section>
      <div v-else class="coach-pointer">
        <span v-if="session.isCoach"
          >Review goals, check-ins, and leave feedback in the Coaches' Dashboard.</span
        >
        <span v-else
          >Open a student's card to review their goals and check-ins and leave feedback.</span
        >
        <RouterLink
          v-if="session.isCoach"
          class="goal-button"
          :to="{ name: 'dashboard', params: { tab: 'goals' } }"
          >Open goal reviews →</RouterLink
        >
      </div>
      <TeamGoalCards @open="openStudent" />
    </template>
  </section>
</template>

<style scoped>
.goals-view {
  max-width: 1040px;
}
h2 {
  margin: 0 0 16px;
  font-size: 20px;
}
.back {
  margin-bottom: 8px;
  padding-left: 0;
  font-size: 13px;
}
.my-goal {
  margin-bottom: 26px;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid var(--team-line);
  border-radius: 10px;
}
.empty p {
  margin: 0;
  color: #3f474e;
  font-size: 14px;
}
.coach-pointer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 22px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--team-softer);
  color: #3f474e;
  font-size: 14px;
}
.coach-pointer .goal-button {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}
</style>
