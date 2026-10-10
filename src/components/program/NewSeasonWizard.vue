<script setup lang="ts">
// Start a new season, in five steps: Season (name and dates; defaults are next year's) → Teams (which carry over) →
// People (Keep / Remove from team / Remove from program, with "Set everyone…" per group) → Tasks (unfinished ones to
// the Backlog, or archived) → Review.
import { computed, reactive, ref } from 'vue'
import { admin } from '@/data'
import { shiftIsoDate } from '@/model/dates'
import {
  ADULT_ROLES,
  ROLE_LABELS,
  type Member,
  type Season,
  type Team,
  type WithId,
} from '@/model/types'
import { useToast } from '@/stores/toast'
import { initials, plural } from '@/ui/format'
import { teamColorOf } from '@/ui/teamColor'
import DateButton from '@/components/ui/DateButton.vue'
import TeamBadge from '@/components/TeamBadge.vue'
import ChoiceMenu from '@/components/ui/ChoiceMenu.vue'
import { seasonDate } from './seasonDate'

const props = defineProps<{
  current: WithId<Season>
  teams: readonly WithId<Team>[]
  inactive: readonly WithId<Team>[]
  members: readonly WithId<Member>[]
}>()
const emit = defineEmits<{ close: [] }>()
const toast = useToast()

const addYear = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`
function nextName(name: string) {
  const match = name.match(/^(\d{4})([–-])(\d{2,4})$/)
  if (!match) return `${name} (next)`
  const start = Number(match[1]) + 1
  return `${start}${match[2]}${String(start + 1).slice(-match[3]!.length)}`
}
const draft = reactive({
  name: nextName(props.current.name),
  start: addYear(props.current.start) as string | null,
  end: addYear(props.current.end) as string | null,
  carried: new Set(props.teams.map((team) => team.id)),
  choices: new Map<string, Choice>(),
  tasks: 'backlog' as 'backlog' | 'archive',
})
type Choice = 'stay' | 'none' | 'remove'
const STEPS = ['Season', 'Teams', 'People', 'Tasks', 'Review']
function rosterLine(teamId: string) {
  const on = props.members.filter((m) => m.teamIds.includes(teamId))
  const students = on.filter((m) => !ADULT_ROLES.includes(m.role)).length
  const mentors = on.filter((m) => m.role === 'mentor').length
  return `${plural(students, 'student')} · ${plural(mentors, 'mentor')}`
}
const step = ref(0)
const allTeams = computed(() => [...props.teams, ...props.inactive])
const teamById = computed(() => new Map(allTeams.value.map((t) => [t.id, t])))

// Everyone except program coaches, with their teams and which of those carry over.
const people = computed(() =>
  props.members
    .filter((member) => member.role !== 'coach')
    .map((member) => ({ member, carried: member.teamIds.filter((id) => draft.carried.has(id)) })),
)
const choiceOf = (person: { member: WithId<Member>; carried: string[] }): Choice =>
  draft.choices.get(person.member.id) ??
  (person.carried.length || !person.member.teamIds.length ? 'stay' : 'none')
const optionsFor = (person: { member: WithId<Member>; carried: string[] }): [Choice, string][] =>
  person.carried.length
    ? [
        ['stay', 'Keep'],
        ['none', 'Remove from team'],
        ['remove', 'Remove from program'],
      ]
    : person.member.teamIds.length
      ? [
          ['none', 'Remove from team'],
          ['remove', 'Remove from program'],
        ]
      : [
          ['stay', 'Keep'],
          ['remove', 'Remove from program'],
        ]
const groups = computed(() =>
  [
    ...allTeams.value
      .filter((team) => draft.carried.has(team.id))
      .map((team) => ({
        key: team.id,
        label: team.name,
        team,
        people: people.value.filter((p) => p.carried[0] === team.id),
      })),
    {
      key: 'dropped',
      label: 'From teams not carried over',
      team: null,
      people: people.value.filter((p) => p.member.teamIds.length && !p.carried.length),
    },
    {
      key: 'none',
      label: 'No team',
      team: null,
      people: people.value.filter((p) => !p.member.teamIds.length),
    },
  ].filter((group) => group.people.length),
)
const tally = computed(() => {
  const counts = { stay: 0, none: 0, remove: 0 }
  people.value.forEach((p) => counts[choiceOf(p)]++)
  return counts
})
const setAll = ref<{ key: string; anchor: HTMLElement } | null>(null)
function applyAll(choice: Choice) {
  const group = groups.value.find((g) => g.key === setAll.value?.key)
  group?.people.forEach((p) => {
    if (optionsFor(p).some(([value]) => value === choice)) draft.choices.set(p.member.id, choice)
  })
}
function toggleCarried(id: string, on: boolean) {
  if (on) draft.carried.add(id)
  else draft.carried.delete(id)
}

const working = ref(false)
function next() {
  if (step.value === 0 && (!draft.name.trim() || !draft.start || !draft.end))
    return toast.show('Give the season a name, a start, and an end')
  if (step.value < STEPS.length - 1) return step.value++
  void start()
}
async function start() {
  working.value = true
  try {
    await admin.startSeason({
      season: { name: draft.name.trim(), start: draft.start!, end: draft.end! },
      old: props.current,
      carried: allTeams.value.filter((t) => draft.carried.has(t.id)),
      people: people.value.map((p) => ({ member: p.member, choice: choiceOf(p) })),
      tasks: draft.tasks,
    })
    toast.show(
      `${draft.name.trim()} started · ${plural(draft.carried.size, 'team')}${tally.value.none ? ` · ${tally.value.none} removed from team` : ''}${tally.value.remove ? ` · ${tally.value.remove} removed from program` : ''}`,
    )
    emit('close')
  } catch (error) {
    toast.show(`Couldn't start the season: ${(error as Error).message}`)
  } finally {
    working.value = false
  }
}
const nameList = (choice: Choice) =>
  people.value
    .filter((p) => choiceOf(p) === choice && (choice !== 'none' || p.member.teamIds.length))
    .map((p) => p.member.displayName)
</script>

<template>
  <div class="goal-modal-overlay" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div
      class="goal-modal season-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Start a new season"
    >
      <div class="goal-modal-head">
        <p class="goal-kicker">New season · {{ STEPS[step] }}</p>
        <div class="dots">
          <button
            v-for="(label, i) in STEPS"
            :key="label"
            type="button"
            class="dot"
            :class="{ current: i === step, done: i < step }"
            :disabled="i > step"
            :aria-label="`Step ${i + 1}: ${label}`"
            @click="step = i"
          />
        </div>
      </div>

      <template v-if="step === 0">
        <h2>Name the season and set its dates</h2>
        <input v-model="draft.name" class="goal-line" maxlength="30" aria-label="Season name" />
        <div class="dates">
          <label
            >Starts
            <DateButton
              v-model="draft.start"
              label="Season start"
              :max="draft.end"
              :clearable="false"
          /></label>
          <label
            >Ends
            <DateButton
              v-model="draft.end"
              label="Season end"
              :min="draft.start"
              :clearable="false"
          /></label>
        </div>
        <p class="goal-example">
          Each team's Sprint 1 starts on this date; sprint lengths stay as they are.
          <template v-if="draft.start && draft.start <= current.end">
            {{ current.name }} will end {{ seasonDate(shiftIsoDate(draft.start, -1)) }}.</template
          >
        </p>
      </template>

      <template v-else-if="step === 1">
        <h2>Which teams carry over?</h2>
        <p class="goal-lead">
          Teams you don't carry over keep their history and can be brought back later.
        </p>
        <ul class="list">
          <li v-for="team in allTeams" :key="team.id">
            <label class="team-row">
              <input
                type="checkbox"
                :checked="draft.carried.has(team.id)"
                @change="toggleCarried(team.id, ($event.target as HTMLInputElement).checked)"
              />
              <TeamBadge :team="team" size="small" />
              <span class="who">
                <strong>{{ team.name }}</strong>
                <small v-if="inactive.includes(team)">Not in {{ current.name }}</small>
                <small v-else>{{ rosterLine(team.id) }}</small>
              </span>
            </label>
          </li>
        </ul>
      </template>

      <template v-else-if="step === 2">
        <h2>Who's on each team this season?</h2>
        <p class="goal-lead">
          Keep people on their team, remove them from the team (they stay in the program with no
          team), or remove them from the program, like graduating students.
        </p>
        <p class="counts">
          {{ tally.stay }} kept · {{ tally.none }} removed from team · {{ tally.remove }} removed
          from program
        </p>
        <section v-for="group in groups" :key="group.key" class="people-group">
          <div class="people-head">
            <h3>
              <span
                v-if="group.team"
                class="team-dot"
                :style="{ background: teamColorOf(group.team.color).bg }"
              />
              {{ group.label }}
            </h3>
            <button
              type="button"
              class="text-button"
              @click="setAll = { key: group.key, anchor: $event.currentTarget as HTMLElement }"
            >
              Set everyone…
            </button>
          </div>
          <ul class="list">
            <li v-for="person in group.people" :key="person.member.id" class="person">
              <span class="avatar">{{ initials(person.member.displayName) }}</span>
              <span class="who">
                <strong>{{ person.member.displayName }}</strong>
                <small>
                  {{ ROLE_LABELS[person.member.role]
                  }}<template v-if="group.team && person.member.teamIds.length > 1">
                    · also
                    {{
                      person.member.teamIds
                        .filter((id) => id !== group.team!.id)
                        .map((id) => teamById.get(id)?.name)
                        .filter(Boolean)
                        .join(', ')
                    }}</template
                  >
                </small>
              </span>
              <span
                class="segmented"
                role="group"
                :aria-label="`${person.member.displayName} this season`"
              >
                <button
                  v-for="[value, text] in optionsFor(person)"
                  :key="value"
                  type="button"
                  :aria-pressed="choiceOf(person) === value"
                  @click="draft.choices.set(person.member.id, value)"
                >
                  {{ text }}
                </button>
              </span>
            </li>
          </ul>
        </section>
        <ChoiceMenu
          v-if="setAll"
          :anchor="setAll.anchor"
          :options="
            optionsFor(groups.find((g) => g.key === setAll!.key)!.people[0]!).map(
              ([value, label]) => ({ value, label }),
            )
          "
          @pick="applyAll($event as Choice)"
          @close="setAll = null"
        />
      </template>

      <template v-else-if="step === 3">
        <h2>What about unfinished tasks?</h2>
        <p class="goal-lead">
          Finished tasks stay with last season's sprints. Goals stay with each student, and active
          goals carry on.
        </p>
        <label class="option">
          <input v-model="draft.tasks" type="radio" value="backlog" />
          <span
            ><strong>Move them to each team's Backlog</strong
            ><small>Teams can plan them into the new season's sprints.</small></span
          >
        </label>
        <label class="option">
          <input v-model="draft.tasks" type="radio" value="archive" />
          <span
            ><strong>Archive them</strong
            ><small>They can be restored from each team's Settings → Archived tasks.</small></span
          >
        </label>
      </template>

      <template v-else>
        <h2>Ready to start {{ draft.name }}?</h2>
        <ul class="summary">
          <li>
            <strong
              >{{ draft.name }} · {{ seasonDate(draft.start!) }} –
              {{ seasonDate(draft.end!) }}</strong
            >
            <small v-if="draft.start! <= current.end"
              >{{ current.name }} ends {{ seasonDate(shiftIsoDate(draft.start!, -1)) }}</small
            >
          </li>
          <li>
            <strong>{{ plural(draft.carried.size, 'team') }} carry over</strong>
            <small v-if="teams.some((t) => !draft.carried.has(t.id))">
              Not carried over:
              {{
                teams
                  .filter((t) => !draft.carried.has(t.id))
                  .map((t) => t.name)
                  .join(', ')
              }}
            </small>
          </li>
          <li>
            <strong>{{
              nameList('none').length
                ? `${plural(nameList('none').length, 'person', 'people')} removed from their team`
                : 'Everyone keeps their team'
            }}</strong>
            <small v-if="nameList('none').length"
              >{{ nameList('none').join(', ') }}. They stay in the program with no team.</small
            >
          </li>
          <li v-if="nameList('remove').length">
            <strong
              >{{ plural(nameList('remove').length, 'person', 'people') }} removed from the
              program</strong
            >
            <small
              >{{ nameList('remove').join(', ') }}. They're taken off their tasks; goal history is
              kept per your retention rules.</small
            >
          </li>
          <li>
            <strong>{{
              draft.tasks === 'backlog'
                ? "Unfinished tasks move to each team's Backlog"
                : 'Unfinished tasks are archived'
            }}</strong>
          </li>
        </ul>
      </template>

      <div class="goal-modal-actions">
        <button type="button" class="goal-button" @click="emit('close')">Cancel</button>
        <button v-if="step > 0" type="button" class="goal-button" @click="step--">Back</button>
        <button type="button" class="goal-button primary" :disabled="working" @click="next">
          {{ step === STEPS.length - 1 ? (working ? 'Starting…' : `Start ${draft.name}`) : 'Next' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.season-modal {
  width: min(640px, 100%);
}
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
.dates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 10px 0;
}
.dates label {
  display: grid;
  gap: 4px;
  color: #4b5560;
  font-size: 12px;
  font-weight: 650;
}
.list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.team-row,
.person {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 4px;
}
.who {
  display: grid;
  flex: 1;
  min-width: 0;
}
.who strong {
  font-size: 14px;
}
.who small {
  color: #737d86;
  font-size: 12px;
}
.counts {
  margin: 0 0 8px;
  color: #59636d;
  font-size: 13px;
  font-weight: 650;
}
.people-group {
  margin-bottom: 10px;
}
.people-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.people-head h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 4px;
  font-size: 14px;
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
.segmented {
  display: flex;
  padding: 2px;
  border-radius: 7px;
  background: #f0f2f4;
}
.segmented button {
  padding: 4px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #59636d;
  font-size: 12px;
  white-space: nowrap;
}
.segmented button[aria-pressed='true'] {
  background: #fff;
  color: #202124;
  font-weight: 650;
  box-shadow: 0 1px 2px rgba(32, 45, 61, 0.12);
}
.option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}
.option span,
.summary li {
  display: grid;
  font-size: 14px;
}
.option small,
.summary small {
  color: #737d86;
  font-size: 12px;
}
.summary {
  display: grid;
  gap: 8px;
  padding-left: 18px;
}
@media (max-width: 680px) {
  .person {
    flex-wrap: wrap;
  }
}
</style>
