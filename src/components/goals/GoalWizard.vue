<script setup lang="ts">
// Setting a goal, one question at a time: intro → what → how I'll know → by when → what might get in the way →
// if-then plan (pre-filled from the obstacle) → first step (fill-in-the-blank starters; becomes a Learning task in
// the current sprint) → review. "Your team will see" shows the statement and status only. Editing opens on review.
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { daysBetween, todayIso } from '@/model/dates'
import {
  GOAL_STEPS,
  goalIdeasFor,
  cleanText,
  hasBlanks,
  planCondition,
  type GoalStepKey,
} from '@/model/goals'
import { goalStatement } from '@/model/types'
import { EVENT_ICONS, useEvents } from '@/composables/useEvents'
import { useGoalActions, type GoalDraft } from '@/composables/useGoalActions'
import type { GoalDoc } from '@/composables/useGoals'
import { useTeam } from '@/composables/useTeamData'
import { useGoalFlow } from '@/stores/goalFlow'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import { formatEventDate, formatShortDate, plural } from '@/ui/format'
import CalendarPopover from '@/components/ui/CalendarPopover.vue'
import GoalStatusPill from './GoalStatusPill.vue'

const props = defineProps<{
  goal: GoalDoc | null
  /** The student's other active goals (for the intro). */
  active: readonly GoalDoc[]
  startAt?: 'by' | 'review'
  replaces: GoalDoc | null
}>()

const flow = useGoalFlow()
const session = useSession()
const toast = useToast()
const team = useTeam()
const actions = useGoalActions()
const editing = !!props.goal

const draft = reactive<GoalDraft & { firstStep: string; addTask: boolean }>({
  wish: props.goal?.wish ?? '',
  evidence: props.goal?.evidence ?? '',
  by: props.goal ? { ...props.goal.by } : null,
  obstacle: props.goal?.obstacle ?? '',
  plan: props.goal?.plan ?? '',
  firstStep: '',
  addTask: true,
})
const questions: GoalStepKey[] = [
  'wish',
  'evidence',
  'by',
  'obstacle',
  'plan',
  ...(editing ? [] : ['firstStep' as const]),
]
type WizardStep = GoalStepKey | 'intro' | 'review'
type TextKey = Exclude<GoalStepKey, 'by'>
const steps: WizardStep[] = [...(editing ? [] : ['intro' as const]), ...questions, 'review']
const index = ref(editing ? steps.indexOf(props.startAt ?? 'review') : 0)
const returnToReview = ref(editing)
const key = computed<WizardStep>(() => steps[index.value]!)
/** The question shown (when it isn't the intro or review). */
const question = computed<GoalStepKey>(() =>
  key.value === 'intro' || key.value === 'review' ? 'wish' : key.value,
)
const textKey = computed<TextKey>(() => (question.value === 'by' ? 'wish' : question.value))
const info = (k: GoalStepKey) => GOAL_STEPS.find((step) => step.key === k)!

function value(k: GoalStepKey): string | null {
  return k === 'by' ? (draft.by ? 'set' : null) : cleanText(draft[k]) || null
}
function complete(k: GoalStepKey): boolean {
  if (k === 'firstStep') return !hasBlanks(draft.firstStep)
  if (k === 'plan')
    return !!cleanText(draft.plan) && !/then I will\s*$/i.test(cleanText(draft.plan))
  return !!value(k)
}
const others = computed(() =>
  props.active.filter((goal) => goal.id !== props.replaces?.id && goal.id !== props.goal?.id),
)

// ---------- by when ----------
const { events } = useEvents(() => team.teamId.value)
const byOptions = computed(() => {
  const today = todayIso()
  const fromEvents = events.value
    .filter((event) => event.date >= today && event.type === 'Competition')
    .map((event) => ({
      label: event.title,
      date: event.date,
      text: `${EVENT_ICONS[event.type]} ${event.title} · ${formatEventDate(event.date)}`,
    }))
  const current = team.sprints.value.findIndex(
    (sprint) => sprint.id === team.currentSprint.value?.id,
  )
  const fromSprints = team.sprints.value
    .slice(Math.max(0, current), Math.max(0, current) + 6)
    .map((sprint) => ({
      label: `End of ${sprint.name}`,
      date: sprint.end,
      text: `End of ${sprint.name} · ${formatShortDate(sprint.end)}`,
    }))
  return [...fromEvents, ...fromSprints].sort((a, b) => a.date.localeCompare(b.date))
})
const customBy = ref(
  !!draft.by &&
    !byOptions.value.some((o) => o.date === draft.by?.date && o.label === draft.by?.label),
)
function pickBy(option: { label: string; date: string }) {
  customBy.value = false
  draft.by = { label: option.label, date: option.date }
}
/** "Pick a date…" opens the calendar right on the button. */
const calendarAnchor = ref<HTMLElement | null>(null)
async function pickCustomDate(iso: string) {
  const row = calendarAnchor.value
  customBy.value = true
  draft.by = { label: formatEventDate(iso), date: iso }
  calendarAnchor.value = null
  await nextTick()
  row?.scrollIntoView({ block: 'nearest' })
}

// ---------- text questions ----------
const input = ref<HTMLTextAreaElement | null>(null)
watch(
  key,
  async (k) => {
    if (k === 'plan' && !cleanText(draft.plan) && cleanText(draft.obstacle))
      draft.plan = `If ${planCondition(draft.obstacle)}, then I will `
    await nextTick()
    const el = input.value
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    } else
      (document.querySelector('.goal-modal .goal-button.primary') as HTMLElement | null)?.focus()
  },
  { immediate: true },
)
function selectFirstBlank() {
  const el = input.value
  if (!el) return
  const at = el.value.search(/_{2,}/)
  if (at >= 0) el.setSelectionRange(at, at + (el.value.slice(at).match(/_+/)?.[0].length ?? 0))
  else el.setSelectionRange(el.value.length, el.value.length)
}
async function useIdea(k: GoalStepKey, idea: string) {
  if (k === 'by') return
  if (k === 'plan') {
    const lead =
      draft.plan.match(/^(.*\bthen I will\s*)/i)?.[1] ??
      `If ${planCondition(draft.obstacle || 'that happens')}, then I will `
    draft.plan = `${lead}${idea}`
  } else draft[k] = idea
  await nextTick()
  input.value?.focus()
  selectFirstBlank()
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    next()
  }
  // Tab hops to the next blank in a fill-in-the-blank starter.
  const el = input.value
  if (event.key === 'Tab' && !event.shiftKey && el && /_{2,}/.test(el.value)) {
    event.preventDefault()
    selectFirstBlank()
  }
}
const ideas = computed(() => {
  const k = question.value
  return k === 'by' ? [] : goalIdeasFor(session.program, k)
})
const ideasLabel = computed(() =>
  question.value === 'plan'
    ? 'Then I will… (tap one or write your own)'
    : question.value === 'firstStep'
      ? 'Tap a starter, then fill in the blanks.'
      : 'Need an idea? Tap one, then make it yours.',
)

// ---------- navigation ----------
const nextLabel = computed(() =>
  editing
    ? 'Done'
    : returnToReview.value
      ? 'Back to review'
      : key.value === 'firstStep' && !cleanText(draft.firstStep)
        ? 'Skip for now'
        : 'Next',
)
function next() {
  if (key.value === 'intro' || key.value === 'review') return
  if (!complete(question.value)) return
  index.value = returnToReview.value ? steps.indexOf('review') : index.value + 1
}
function back() {
  if (index.value === 0 || (editing && key.value === 'review')) return flow.close()
  index.value--
}
function jump(k: GoalStepKey) {
  returnToReview.value = true
  index.value = steps.indexOf(k)
}

function save() {
  if (!questions.every(complete)) return
  if (props.goal) {
    actions.edit(props.goal, draft)
    return flow.next()
  }
  const firstStep = cleanText(draft.firstStep)
  const id = actions.create(draft, firstStep && draft.addTask ? firstStep : null)
  if (!id) return toast.show("Couldn't save the goal. Try again.")
  if (props.replaces) actions.changeTo(props.replaces, goalStatement(cleanText(draft.wish)))
  flow.next()
  toast.show(
    firstStep && draft.addTask
      ? 'Goal saved 🎯 Your first step is on the board as a Learning task.'
      : 'Goal saved 🎯',
  )
}
</script>

<template>
  <!-- Intro -->
  <template v-if="key === 'intro'">
    <p class="goal-kicker">Set my goal</p>
    <h2>
      {{
        replaces
          ? 'Set your new goal'
          : others.length
            ? 'Add another goal'
            : "Let's set your learning goal"
      }}
    </h2>
    <p v-if="replaces || others.length" class="goal-lead">
      <template v-if="replaces"
        >“{{ goalStatement(replaces.wish) }}” will move to your goal history as Changed.
      </template>
      <template v-else-if="others.length">
        You're already working on “{{ goalStatement(others[0]!.wish) }}”<template
          v-if="others.length > 1"
        >
          and {{ plural(others.length - 1, 'other goal') }}</template
        >. Another goal is fine; you'll check in on each one every sprint.
      </template>
    </p>
    <p class="goal-lead">
      It takes about 5 minutes. After that, you'll check in for about a minute at the end of each
      sprint.
    </p>
    <ol class="intro-steps">
      <li>What you want to learn</li>
      <li>How you'll know you've got it</li>
      <li>When you're aiming for</li>
      <li>What might get in your way</li>
      <li>Your if-then plan for that</li>
      <li>One first step this sprint</li>
    </ol>
    <div class="intro-privacy">
      <p><strong>Your team sees</strong> your goal and how it's going.</p>
      <p>
        <strong>Only you and your coaches see</strong> everything else: your plan, check-ins, and
        feedback.
      </p>
    </div>
    <p class="goal-example tip">
      Tip: pick something you want to learn, not just a result. “Learn to explain my design choices”
      beats “Win our next competition.”
    </p>
    <div class="goal-modal-actions">
      <button type="button" class="goal-button" @click="flow.close()">Cancel</button>
      <button type="button" class="goal-button primary" @click="index++">Let's go</button>
    </div>
  </template>

  <!-- Review -->
  <template v-else-if="key === 'review'">
    <div class="goal-modal-head">
      <p class="goal-kicker">{{ editing ? 'Edit my goal' : 'Last step' }}</p>
      <div class="dots">
        <button
          v-for="q in questions"
          :key="q"
          type="button"
          class="dot done"
          :aria-label="`Go to: ${info(q).title}`"
          @click="jump(q)"
        />
      </div>
    </div>
    <h2>{{ editing ? 'Change any part of your goal' : 'Look it over' }}</h2>
    <section class="review-block shared">
      <p class="review-label">👀 Your team will see</p>
      <div class="review-title">
        <p class="review-statement">{{ goalStatement(cleanText(draft.wish)) }}</p>
        <button type="button" class="text-button" @click="jump('wish')">Edit</button>
      </div>
      <div v-if="goal" class="goal-meta">
        <GoalStatusPill :status="goal.status" />
      </div>
    </section>
    <section class="review-block">
      <p class="review-label">🔒 Only you and your coaches see</p>
      <dl class="review-rows">
        <div
          v-for="row in [
            [`I'll know I've got it when`, cleanText(draft.evidence), 'evidence'],
            [
              'By',
              draft.by
                ? `${draft.by.label}${draft.by.date && draft.by.label !== formatEventDate(draft.by.date) ? ` · ${formatEventDate(draft.by.date)}` : ''}`
                : '',
              'by',
            ],
            ['What might get in the way', cleanText(draft.obstacle), 'obstacle'],
            ['My if-then plan', cleanText(draft.plan), 'plan'],
          ] as const"
          :key="row[2]"
          class="review-row"
        >
          <dt>{{ row[0] }}</dt>
          <dd>{{ row[1] || '—' }}</dd>
          <button type="button" class="text-button" @click="jump(row[2])">Edit</button>
        </div>
      </dl>
    </section>
    <section v-if="!editing" class="review-block">
      <p class="review-label">First step</p>
      <dl class="review-rows">
        <div class="review-row">
          <dt>This sprint I'll</dt>
          <dd>{{ cleanText(draft.firstStep) || 'Skipped for now' }}</dd>
          <button type="button" class="text-button" @click="jump('firstStep')">Edit</button>
        </div>
      </dl>
      <label v-if="cleanText(draft.firstStep)" class="add-task">
        <input v-model="draft.addTask" type="checkbox" />
        Add it as a Learning task for me in {{ team.currentSprint.value?.name ?? 'this sprint' }}
      </label>
    </section>
    <div class="goal-modal-actions">
      <button type="button" class="goal-button" @click="back">
        {{ editing ? 'Cancel' : 'Back' }}
      </button>
      <button
        type="button"
        class="goal-button primary"
        :disabled="!questions.every(complete)"
        @click="save"
      >
        {{ editing ? 'Save changes' : 'Save my goal' }}
      </button>
    </div>
  </template>

  <!-- A question -->
  <template v-else>
    <div class="goal-modal-head">
      <p class="goal-kicker">
        {{
          editing
            ? 'Edit my goal'
            : `Step ${questions.indexOf(question) + 1} of ${questions.length}`
        }}
      </p>
      <div class="dots">
        <button
          v-for="(q, i) in questions"
          :key="q"
          type="button"
          class="dot"
          :class="{ current: q === question, done: i < questions.indexOf(question) || !!value(q) }"
          :aria-label="`Go to: ${info(q).title}`"
          :disabled="!editing && i > questions.indexOf(question) && !value(q)"
          @click="index = steps.indexOf(q)"
        />
      </div>
    </div>
    <h2>{{ info(question).title }}</h2>
    <p class="goal-lead">{{ info(question).lead }}</p>
    <div class="step-body">
      <template v-if="question === 'by'">
        <div class="by-options" role="radiogroup" aria-label="By when">
          <button
            v-for="option in byOptions"
            :key="`${option.label}-${option.date}`"
            type="button"
            class="by-option"
            role="radio"
            :aria-checked="
              !customBy && draft.by?.date === option.date && draft.by?.label === option.label
            "
            @click="pickBy(option)"
          >
            <span>{{ option.text }}</span>
            <small>in {{ daysBetween(todayIso(), option.date) }} days</small>
          </button>
          <button
            type="button"
            class="by-option"
            role="radio"
            :aria-checked="customBy"
            aria-haspopup="dialog"
            @click="calendarAnchor = calendarAnchor ? null : ($event.currentTarget as HTMLElement)"
          >
            <span>{{
              customBy && draft.by?.date ? `📅 ${formatEventDate(draft.by.date)}` : 'Pick a date…'
            }}</span>
            <small v-if="customBy && draft.by?.date"
              >in {{ daysBetween(todayIso(), draft.by.date) }} days</small
            >
          </button>
        </div>
        <CalendarPopover
          v-if="calendarAnchor"
          :anchor="calendarAnchor"
          label="Goal date"
          :selected="customBy ? (draft.by?.date ?? null) : null"
          :min="todayIso()"
          @pick="pickCustomDate"
          @close="calendarAnchor = null"
        />
        <p class="goal-example">Most goals take 2 to 4 sprints. Competitions make good targets.</p>
      </template>
      <template v-else>
        <textarea
          ref="input"
          v-model="draft[textKey]"
          class="goal-text"
          rows="2"
          maxlength="160"
          :placeholder="info(question).starter"
          :aria-label="info(question).title"
          @keydown="onKeydown"
        />
        <p class="goal-hint">{{ info(question).hint?.(draft[textKey]) }}</p>
        <p v-if="question === 'wish' && cleanText(draft.wish)" class="preview">
          Your goal will read: “{{ goalStatement(cleanText(draft.wish)) }}”
        </p>
        <template v-if="ideas.length">
          <p class="goal-ideas-label">{{ ideasLabel }}</p>
          <div class="goal-ideas">
            <button
              v-for="idea in ideas"
              :key="idea"
              type="button"
              class="goal-idea"
              @click="useIdea(question, idea)"
            >
              {{ idea }}
            </button>
          </div>
        </template>
      </template>
    </div>
    <div class="goal-modal-actions">
      <button type="button" class="goal-button" @click="back">
        {{ index === 0 ? 'Cancel' : 'Back' }}
      </button>
      <button
        type="button"
        class="goal-button primary"
        :disabled="!complete(question)"
        @click="next"
      >
        {{ nextLabel }}
      </button>
    </div>
  </template>
</template>

<style scoped>
.dots {
  display: flex;
  gap: 5px;
}
.dot {
  width: 22px;
  height: 6px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: #e3e7eb;
}
.dot.done {
  background: var(--team-line);
}
.dot.current {
  background: var(--team-ink);
}
.dot:disabled {
  cursor: default;
}
.intro-steps {
  display: grid;
  gap: 4px;
  margin: 4px 0 14px;
  padding-left: 22px;
  color: #3f474e;
  font-size: 14px;
}
.intro-privacy {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--team-softer);
}
.intro-privacy p {
  margin: 0;
  color: #3f474e;
  font-size: 13px;
}
.tip {
  margin-top: 10px;
}
.step-body {
  display: grid;
  gap: 6px;
}
.preview {
  margin: 0;
  color: var(--team-ink);
  font-size: 14px;
  font-weight: 650;
}
.by-options {
  display: grid;
  gap: 4px;
  max-height: 260px;
  overflow-y: auto;
}
.by-option {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  text-align: left;
}
.by-option small {
  color: #8a949c;
  white-space: nowrap;
}
.by-option:hover {
  border-color: var(--team-line);
}
.by-option[aria-checked='true'] {
  border-color: var(--team-ink);
  background: var(--team-softer);
  color: var(--team-ink);
  font-weight: 650;
}
.review-block {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.review-block.shared {
  border-color: var(--team-line);
  background: var(--team-softer);
}
.review-label {
  margin: 0 0 6px;
  color: #66717a;
  font-size: 12px;
  font-weight: 700;
}
.review-statement {
  margin: 0 0 6px;
  color: #202124;
  font-size: 17px;
  font-weight: 700;
}
.review-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.review-title .review-statement {
  margin-bottom: 0;
}
.review-title + .goal-meta {
  margin-top: 6px;
}
.review-rows {
  display: grid;
  gap: 6px;
  margin: 0;
}
.review-row {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
}
.review-row dt {
  color: #66717a;
  font-weight: 600;
}
.review-row dd {
  margin: 0;
  color: #2c343b;
}
.add-task {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  color: #59636d;
  font-size: 13px;
}
@media (max-width: 680px) {
  .review-row {
    grid-template-columns: 1fr auto;
  }
  .review-row dd {
    grid-column: 1;
  }
}
</style>
