<script setup lang="ts">
// The sprint check-in: 1. where are you (status), 2. what did you do (your finished tasks in the covered sprint;
// ones from this goal are listed first and pre-ticked), 3. did your if-then plan come up (rewrite it if it didn't
// work), 4. next steps (each becomes a Learning task in the sprint you pick). "Got it" goes on to the wrap-up.
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { todayIso } from '@/model/dates'
import { GOAL_STATUSES, PLAN_RESULTS, checkinWindow, cleanText } from '@/model/goals'
import { goalStatement, type GoalStatus, type PlanResult } from '@/model/types'
import { useGoalActions } from '@/composables/useGoalActions'
import { needsOf, type GoalDoc } from '@/composables/useGoals'
import { useTeam } from '@/composables/useTeamData'
import { useSession } from '@/stores/session'
import { useGoalFlow } from '@/stores/goalFlow'
import { useToast } from '@/stores/toast'
import { plural } from '@/ui/format'
import SelectButton from '@/components/ui/SelectButton.vue'

const props = defineProps<{ goal: GoalDoc }>()

const team = useTeam()
const session = useSession()
const flow = useGoalFlow()
const toast = useToast()
const actions = useGoalActions()

const due = computed(() => needsOf(props.goal, team.sprints.value).due)
const covered = computed(
  () =>
    due.value?.sprint ??
    checkinWindow(team.sprints.value, todayIso())?.sprint ??
    team.currentSprint.value,
)
const coveredId = computed(
  () => team.sprints.value.find((s) => s.name === covered.value?.name)?.id ?? null,
)
const current = computed(() => team.currentSprint.value)
const nextSprint = computed(() => {
  const i = team.sprints.value.findIndex((s) => s.id === current.value?.id)
  return i >= 0 ? (team.sprints.value[i + 1] ?? null) : null
})
// Overdue check-ins happen mid-sprint, so new steps default to the current sprint; end-of-sprint ones to the next.
const defaultSprintId = computed(
  () => (due.value?.overdue || !nextSprint.value ? current.value?.id : nextSprint.value.id) ?? '',
)

const answer = reactive({
  status: null as GoalStatus | null,
  taskIds: new Set<string>(),
  note: '',
  planResult: null as PlanResult | null,
  newPlan: props.goal.plan,
  steps: [{ title: '', sprintId: '' }] as { title: string; sprintId: string }[],
})
onMounted(async () => {
  answer.steps.forEach((step) => (step.sprintId = defaultSprintId.value))
  // A finished task created from this goal is almost certainly evidence, so it starts ticked.
  tasks.value.filter((task) => task.fromGoal).forEach((task) => answer.taskIds.add(task.id))
  await nextTick()
  ;(document.querySelector('.goal-modal .choice') as HTMLElement | null)?.focus()
})

/** My finished tasks in the covered sprint, from this goal first. */
const tasks = computed(() => {
  const uid = session.member?.id ?? ''
  return team.tasks.value
    .filter(
      (task) =>
        task.sprintId === coveredId.value &&
        task.status === 'Done' &&
        task.assigneeIds.includes(uid),
    )
    .map((task) => ({ id: task.id, title: task.title, fromGoal: task.goalId === props.goal.id }))
    .sort((a, b) => Number(b.fromGoal) - Number(a.fromGoal))
})
function toggleTask(id: string, on: boolean) {
  if (on) answer.taskIds.add(id)
  else answer.taskIds.delete(id)
}

const sprintChoices = computed(() =>
  [current.value, nextSprint.value].flatMap((sprint, i) =>
    sprint ? [{ value: sprint.id, label: `${sprint.name} · ${i === 0 ? 'now' : 'next'}` }] : [],
  ),
)
const stepInputs = ref<HTMLInputElement[]>([])
async function addStep() {
  answer.steps.push({ title: '', sprintId: defaultSprintId.value })
  await nextTick()
  stepInputs.value.at(-1)?.focus()
}
function removeStep(index: number) {
  answer.steps.splice(index, 1)
  if (!answer.steps.length) void addStep()
}
function onStepKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    void addStep()
  }
}

const gotIt = computed(() => answer.status === 'Got it')
const filledSteps = computed(() =>
  gotIt.value ? [] : answer.steps.filter((step) => step.title.trim()),
)
const ready = computed(() => !!answer.status && !!answer.planResult)

function save() {
  if (!ready.value || !answer.status || !answer.planResult) return
  const rewritten = cleanText(answer.newPlan)
  const newPlan =
    answer.planResult === "It didn't work" && rewritten && rewritten !== props.goal.plan
      ? rewritten
      : null
  actions.checkin(props.goal, {
    status: answer.status,
    taskIds: [...answer.taskIds],
    note: answer.note.trim(),
    planResult: answer.planResult,
    newPlan,
    steps: filledSteps.value.map((step) => ({
      title: cleanText(step.title),
      sprintId: step.sprintId,
    })),
  })
  if (gotIt.value) return flow.replace({ kind: 'reflection', goalId: props.goal.id })
  flow.next()
  toast.show(
    filledSteps.value.length
      ? `Check-in saved. ${plural(filledSteps.value.length, 'Learning task')} added.`
      : 'Check-in saved',
  )
}
</script>

<template>
  <div class="goal-modal-head">
    <p class="goal-kicker">Sprint check-in · {{ covered?.name }}</p>
  </div>
  <h2>{{ goalStatement(goal.wish) }}</h2>
  <div class="checkin-form">
    <fieldset class="checkin-question">
      <legend><span class="question-number">1.</span>Where are you?</legend>
      <div class="choice-row">
        <button
          v-for="(status, i) in GOAL_STATUSES"
          :key="status"
          type="button"
          :class="`choice goal-status s-${i + 1}`"
          :aria-pressed="answer.status === status"
          @click="answer.status = status"
        >
          {{ status }}
        </button>
      </div>
    </fieldset>

    <fieldset class="checkin-question">
      <legend><span class="question-number">2.</span>What did you do?</legend>
      <div class="tasks">
        <p v-if="!tasks.length" class="goal-example">
          No finished tasks in {{ covered?.name }} yet. Add a quick note instead.
        </p>
        <label v-for="task in tasks" :key="task.id">
          <input
            type="checkbox"
            :checked="answer.taskIds.has(task.id)"
            @change="toggleTask(task.id, ($event.target as HTMLInputElement).checked)"
          />
          {{ task.title }}
        </label>
      </div>
      <input
        v-model="answer.note"
        class="goal-line"
        maxlength="140"
        placeholder="Anything else? (optional)"
        aria-label="Anything else"
      />
    </fieldset>

    <fieldset class="checkin-question">
      <legend><span class="question-number">3.</span>Did your if-then plan come up?</legend>
      <p class="goal-example my-plan">{{ goal.plan }}</p>
      <div class="choice-row">
        <button
          v-for="result in PLAN_RESULTS"
          :key="result"
          type="button"
          class="choice"
          :aria-pressed="answer.planResult === result"
          @click="answer.planResult = result"
        >
          {{ result }}
        </button>
      </div>
      <template v-if="answer.planResult === `It didn't work`">
        <p class="goal-example">
          Plans often need a tweak. Rewrite it so it works better next time:
        </p>
        <textarea
          v-model="answer.newPlan"
          class="goal-text"
          rows="2"
          maxlength="160"
          aria-label="New if-then plan"
        />
      </template>
    </fieldset>

    <fieldset v-if="!gotIt" class="checkin-question">
      <legend><span class="question-number">4.</span>What are your next steps?</legend>
      <p class="goal-example">Each step becomes a Learning task for you in the sprint you pick.</p>
      <div class="next-steps">
        <div v-for="(step, i) in answer.steps" :key="i" class="next-step-row">
          <input
            ref="stepInputs"
            v-model="step.title"
            class="goal-line"
            maxlength="90"
            placeholder="My next step is…"
            aria-label="Next step"
            @keydown="onStepKeydown"
          />
          <SelectButton
            v-model="step.sprintId"
            class="step-sprint"
            label="Sprint for this step"
            :options="sprintChoices"
          >
            <template #value="{ value }">{{
              sprintChoices.find((c) => c.value === value)?.label
            }}</template>
          </SelectButton>
          <button
            type="button"
            class="step-remove"
            aria-label="Remove this step"
            @click="removeStep(i)"
          >
            ×
          </button>
        </div>
      </div>
      <button type="button" class="text-button add-step" @click="addStep()">
        ＋ Add another step
      </button>
    </fieldset>
  </div>
  <div class="goal-modal-actions">
    <button type="button" class="goal-button" @click="flow.close()">Cancel</button>
    <button type="button" class="goal-button primary" :disabled="!ready" @click="save">
      Save check-in
    </button>
  </div>
</template>

<style scoped>
.my-plan {
  font-style: italic;
}
.tasks {
  display: grid;
  gap: 4px;
  font-size: 13px;
}
.tasks label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.next-steps {
  display: grid;
  gap: 6px;
}
.next-step-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px 30px;
  gap: 6px;
}
.step-sprint {
  min-height: 40px;
  border-radius: 8px;
}
.step-remove {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #8a949c;
  font-size: 18px;
}
.step-remove:hover {
  background: #f3f5f8;
  color: #a43d34;
}
.add-step {
  justify-self: start;
}
@media (max-width: 680px) {
  .next-step-row {
    grid-template-columns: minmax(0, 1fr) 30px;
  }
  .step-sprint {
    grid-column: 1;
  }
}
</style>
