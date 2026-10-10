<script setup lang="ts">
// Planning (the mock-up's "Backlog" tab): the unplanned Backlog, then every sprint as a collapsible section with its
// objectives (editable here) and tasks, then "Past sprints (N)". Dense: 12px text, ~29px rows, one pinned column
// header. Sprint dates are buttons that open the calendar: start (saved at once, then optionally an end) and end.
// Drag rows to reorder them, or onto another sprint or the Backlog (open or collapsed) to move them there.
import { computed, ref } from 'vue'
import { writes } from '@/data'
import { todayIso } from '@/model/dates'
import { earliestSprintDate, rescheduleSprint } from '@/model/sprints'
import type { Sprint, Task, WithId } from '@/model/types'
import { useTaskEdits } from '@/composables/useTaskEdits'
import { useTeam } from '@/composables/useTeamData'
import { subtaskKey, useSelection } from '@/composables/useSelection'
import { useToast } from '@/stores/toast'
import { vDragSort, type TaskDrop } from '@/ui/dragSort'
import { formatDotted, formatShortDate, plural } from '@/ui/format'
import AnnouncementBanner from '@/components/tasks/AnnouncementBanner.vue'
import BulkBar from '@/components/tasks/BulkBar.vue'
import ObjectivesPanel from '@/components/tasks/ObjectivesPanel.vue'
import TaskRows from '@/components/tasks/TaskRows.vue'
import type { TaskField } from '@/components/tasks/TaskFieldCell.vue'
import CalendarPopover from '@/components/ui/CalendarPopover.vue'
import ChoiceMenu from '@/components/ui/ChoiceMenu.vue'

const team = useTeam()
const toast = useToast()
const COLUMNS: TaskField[] = ['status', 'due', 'assignee', 'subteam', 'type']
const today = todayIso()

interface Section {
  key: string
  sprint: WithId<Sprint> | null
  tasks: WithId<Task>[]
}
const sectionFor = (sprint: WithId<Sprint> | null): Section => ({
  key: sprint?.id ?? 'backlog',
  sprint,
  tasks: team.tasksIn(sprint?.id ?? null),
})
const currentId = computed(() => team.currentSprint.value?.id)
const upcoming = computed(() =>
  team.sprints.value
    .filter((sprint) => sprint.id === currentId.value || sprint.end >= today)
    .map(sectionFor),
)
const past = computed(() =>
  team.sprints.value
    .filter((sprint) => sprint.id !== currentId.value && sprint.end < today)
    .map(sectionFor),
)
const sections = computed(() => [sectionFor(null), ...upcoming.value])

// Backlog and the current sprint start open; Past sprints is closed on every load.
const open = ref<Set<string>>(new Set(['backlog', 'current']))
const isOpen = (section: Section) =>
  open.value.has(section.key) ||
  (section.sprint?.id === currentId.value && open.value.has('current'))
function toggle(section: Section) {
  const next = new Set(open.value)
  if (isOpen(section)) {
    next.delete(section.key)
    if (section.sprint?.id === currentId.value) next.delete('current')
  } else next.add(section.key)
  open.value = next
}
const pastOpen = ref(false)

function summary(section: Section) {
  const objectives = section.sprint?.objectives.length ?? 0
  return [
    objectives ? plural(objectives, 'objective') : '',
    section.tasks.length ? plural(section.tasks.length, 'task') : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

// ---------- selection and Move to ----------
const order = () =>
  [...sections.value, ...(pastOpen.value ? past.value : [])].flatMap((section) =>
    section.tasks.flatMap((task) => [
      task.id,
      ...task.subtasks.filter((s) => !s.archived).map((s) => subtaskKey(task.id, s.id)),
    ]),
  )
const selection = useSelection(order)

const moveFor = ref<{ task: WithId<Task>; anchor: HTMLElement } | null>(null)
const moveOptions = computed(() => {
  const here = moveFor.value?.task.sprintId ?? null
  return [null, ...upcoming.value.map((section) => section.sprint)].map((sprint) => ({
    value: sprint?.id ?? null,
    label: sprint?.name ?? 'Backlog',
    disabled: (sprint?.id ?? null) === here,
    meta:
      (sprint?.id ?? null) === here
        ? 'Here now'
        : !sprint
          ? 'Unplanned'
          : `${sprint.id === currentId.value ? 'Current · ' : ''}${formatShortDate(sprint.start)} – ${formatShortDate(sprint.end)}`,
  }))
})
function moveTask(sprintId: string | null) {
  const task = moveFor.value?.task
  if (!task || !team.teamId.value) return
  writes
    .updateTask(team.teamId.value, task.id, { sprintId })
    .catch((error: Error) => toast.show(`Couldn't move: ${error.message}`))
  toast.show(`Moved “${task.title}” to ${team.sprintName(sprintId)}`)
}

// ---------- drag and drop ----------
const edits = useTaskEdits(team)
const dragTo = (key: string) => ({
  group: 'planning',
  key,
  draggable: 'tr.task-row',
  onDrop: (drop: TaskDrop) => {
    const sprintId = drop.to === 'backlog' ? null : drop.to
    const task = edits.drop(drop, { sprintId })
    if (task && drop.from !== drop.to)
      toast.show(`Moved “${task.title}” to ${team.sprintName(sprintId)}`)
  },
})

// ---------- sprint dates ----------
const calendar = ref<{
  index: number
  edge: 'start' | 'end'
  pickedStart: boolean
  anchor: HTMLElement
} | null>(null)
const calendarSprint = computed(() =>
  calendar.value ? team.sprints.value[calendar.value.index] : null,
)
function openCalendar(sprint: WithId<Sprint>, edge: 'start' | 'end', event: MouseEvent) {
  const index = team.sprints.value.findIndex((item) => item.id === sprint.id)
  const anchor = event.currentTarget as HTMLElement
  calendar.value =
    calendar.value?.anchor === anchor ? null : { index, edge, pickedStart: false, anchor }
}
function pickDate(iso: string) {
  const state = calendar.value
  const teamId = team.teamId.value
  if (!state || !teamId) return
  const changes = rescheduleSprint(team.sprints.value, state.index, { [state.edge]: iso })
  if (changes.length)
    writes
      .updateSprints(teamId, changes)
      .catch((error: Error) => toast.show(`Couldn't save: ${error.message}`))
  // Start: stay open for an optional end date. End: done.
  if (state.edge === 'start' && !state.pickedStart)
    calendar.value = { ...state, edge: 'end', pickedStart: true }
  else calendar.value = null
}
const calendarNote = computed(() => {
  const state = calendar.value
  const sprint = calendarSprint.value
  if (!state || !sprint) return ''
  if (state.pickedStart)
    return `Now pick an end date, or click away to keep ${formatDotted(sprint.end)}.`
  if (state.edge === 'start') return 'Pick a new start date.'
  return team.sprints.value[state.index + 1]
    ? 'Later sprints move with the end date.'
    : 'Pick a new end date.'
})
</script>

<template>
  <AnnouncementBanner />
  <div class="planning">
    <table class="task-table dense">
      <colgroup>
        <col />
        <col style="width: 112px" />
        <col style="width: 92px" />
        <col style="width: 150px" />
        <col style="width: 150px" />
        <col style="width: 86px" />
        <col style="width: 86px" />
      </colgroup>
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Due date</th>
          <th>Assignee</th>
          <th>Subteam</th>
          <th>Type</th>
          <th><span class="sr-only">Move to</span></th>
        </tr>
      </thead>

      <template v-for="section in sections" :key="section.key">
        <tbody v-drag-sort="dragTo(section.key)" class="section" :class="{ open: isOpen(section) }">
          <tr class="section-row">
            <td colspan="7">
              <div class="section-head">
                <button
                  type="button"
                  class="section-toggle"
                  :aria-expanded="isOpen(section)"
                  @click="toggle(section)"
                >
                  <span class="arrow" aria-hidden="true">▾</span>
                  <span class="sprint-title">{{ section.sprint?.name ?? 'Backlog' }}</span>
                </button>
                <span v-if="section.sprint" class="sprint-dates">
                  <button
                    v-if="team.can.value.plan"
                    type="button"
                    class="date-edge"
                    :aria-label="`${section.sprint.name} starts ${formatDotted(section.sprint.start)}. Change start date`"
                    aria-haspopup="dialog"
                    @click="openCalendar(section.sprint, 'start', $event)"
                  >
                    {{ formatDotted(section.sprint.start) }}
                  </button>
                  <span v-else>{{ formatDotted(section.sprint.start) }}</span>
                  –
                  <button
                    v-if="team.can.value.plan"
                    type="button"
                    class="date-edge"
                    :aria-label="`${section.sprint.name} ends ${formatDotted(section.sprint.end)}. Change end date`"
                    aria-haspopup="dialog"
                    @click="openCalendar(section.sprint, 'end', $event)"
                  >
                    {{ formatDotted(section.sprint.end) }}
                  </button>
                  <span v-else>{{ formatDotted(section.sprint.end) }}</span>
                </span>
                <span v-if="section.sprint?.id === currentId" class="current-chip"
                  >Current Sprint</span
                >
                <small v-if="!isOpen(section)" class="section-count">{{ summary(section) }}</small>
              </div>
            </td>
          </tr>
          <template v-if="isOpen(section)">
            <tr v-if="section.sprint" class="objectives-row">
              <td colspan="7">
                <ObjectivesPanel
                  :team-id="team.teamId.value!"
                  :sprints="[section.sprint]"
                  :subteams="team.subteams.value"
                  :can-mark="team.can.value.plan"
                  :editable="team.can.value.plan"
                  collapsed
                />
              </td>
            </tr>
            <TaskRows
              :team="team"
              :tasks="section.tasks"
              :columns="COLUMNS"
              quiet
              subtask-button
              extra
              :is-selected="selection.has"
              :new-task="{ sprintId: section.sprint?.id ?? null }"
              @select="selection.toggle"
            >
              <template #extra="{ task }">
                <button
                  type="button"
                  class="move-button"
                  aria-haspopup="menu"
                  :aria-label="`Move ${task.title} to another sprint`"
                  @click="moveFor = { task, anchor: $event.currentTarget as HTMLElement }"
                >
                  Move to ▾
                </button>
              </template>
            </TaskRows>
          </template>
        </tbody>
      </template>

      <tbody v-if="past.length" class="section past">
        <tr class="section-row">
          <td colspan="7">
            <button
              type="button"
              class="section-toggle"
              :aria-expanded="pastOpen"
              @click="pastOpen = !pastOpen"
            >
              <span class="arrow" aria-hidden="true">▾</span>
              <span class="sprint-title">Past sprints ({{ past.length }})</span>
            </button>
          </td>
        </tr>
      </tbody>
      <template v-if="pastOpen">
        <tbody
          v-for="section in past"
          :key="section.key"
          v-drag-sort="dragTo(section.key)"
          class="section past-sprint"
        >
          <tr class="section-row">
            <td colspan="7">
              <div class="section-head">
                <button
                  type="button"
                  class="section-toggle"
                  :aria-expanded="isOpen(section)"
                  @click="toggle(section)"
                >
                  <span class="arrow" aria-hidden="true">▾</span>
                  <span class="sprint-title">{{ section.sprint?.name }}</span>
                </button>
                <span class="sprint-dates"
                  >{{ formatDotted(section.sprint!.start) }} –
                  {{ formatDotted(section.sprint!.end) }}</span
                >
                <small v-if="!isOpen(section)" class="section-count">{{ summary(section) }}</small>
              </div>
            </td>
          </tr>
          <template v-if="isOpen(section)">
            <tr class="objectives-row">
              <td colspan="7">
                <ObjectivesPanel
                  :team-id="team.teamId.value!"
                  :sprints="[section.sprint!]"
                  :subteams="team.subteams.value"
                  :can-mark="team.can.value.plan"
                  :editable="team.can.value.plan"
                  collapsed
                />
              </td>
            </tr>
            <TaskRows
              :team="team"
              :tasks="section.tasks"
              :columns="COLUMNS"
              quiet
              extra
              :is-selected="selection.has"
              @select="selection.toggle"
            >
              <template #extra="{ task }">
                <button
                  type="button"
                  class="move-button"
                  aria-haspopup="menu"
                  @click="moveFor = { task, anchor: $event.currentTarget as HTMLElement }"
                >
                  Move to ▾
                </button>
              </template>
            </TaskRows>
          </template>
        </tbody>
      </template>
    </table>
  </div>

  <ChoiceMenu
    v-if="moveFor"
    :key="moveFor.task.id"
    :anchor="moveFor.anchor"
    heading="Move to"
    align="right"
    :options="moveOptions"
    @pick="moveTask($event as string | null)"
    @close="moveFor = null"
  />
  <CalendarPopover
    v-if="calendar && calendarSprint"
    :key="`${calendar.index}-${calendar.edge}`"
    :anchor="calendar.anchor"
    :label="`Choose ${calendarSprint.name} ${calendar.edge} date`"
    :selected="calendarSprint[calendar.edge]"
    :range="calendarSprint"
    :min="earliestSprintDate(team.sprints.value, calendar.index, calendar.edge)"
    :note="calendarNote"
    @pick="pickDate"
    @close="calendar = null"
  />
  <BulkBar
    :items="selection.keys.value.map((key) => ({ key, team }))"
    move-to
    assignable
    @clear="selection.clear()"
  />
</template>

<style scoped>
/* A scrolling wrapper would capture the pinned header, so only narrow screens scroll sideways (and pin nothing). */
@media (max-width: 900px) {
  .planning {
    overflow-x: auto;
  }
  .planning .task-table {
    min-width: 860px;
  }
  .planning thead th {
    position: static;
  }
}
/* One pinned column header under the top bar. */
thead th {
  position: sticky;
  z-index: 2;
  top: var(--topbar-h);
  background: #fff;
}
.section-row td {
  height: auto;
  padding: 11px 6px !important;
  border-bottom: 0;
}
.section + .section .section-row td {
  border-top: 1px solid var(--line);
}
.section.open .section-row td {
  padding-bottom: 6px !important;
}
.section:first-of-type.open {
  border-bottom: 24px solid transparent;
}
.section-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #202124;
}
.arrow {
  color: #737d86;
  font-size: 10px;
  transition: transform 0.15s;
}
.section-toggle[aria-expanded='false'] .arrow {
  transform: rotate(-90deg);
}
.sprint-title {
  font-size: 14px;
  font-weight: 700;
}
.sprint-dates {
  color: #6b757e;
  font-size: 12px;
}
.date-edge {
  padding: 1px 3px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
}
.date-edge:hover,
.date-edge[aria-expanded='true'] {
  border-color: #d5dce5;
  background: #fff;
  color: var(--team-ink);
}
.current-chip {
  padding: 1px 7px;
  border-radius: 10px;
  background: var(--team-soft);
  color: var(--team-ink);
  font-size: 11px;
  font-weight: 650;
}
.section-count {
  margin-left: auto;
  color: #8a949c;
  font-size: 12px;
}
.objectives-row td {
  height: auto;
  padding: 2px 6px 6px 20px !important;
  border-bottom: 0;
}
.objectives-row :deep(.objectives) {
  padding: 3px 10px;
}
.objectives-row :deep(.objectives-toggle h3) {
  color: #59636d;
  font-size: 11px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
.move-button {
  padding: 1px 7px;
  border: 1px solid #d5dce5;
  border-radius: 5px;
  background: #fff;
  color: #4d5962;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
}
tr:hover .move-button,
tr:focus-within .move-button,
.move-button[aria-expanded='true'] {
  opacity: 1;
}
@media (hover: none) {
  .move-button {
    opacity: 1;
  }
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
