<script setup lang="ts">
// One section of a task table (a status group in List, a sprint in Planning, a team on the dashboard): task rows,
// their subtasks (▸ expands them; they read as steps and reorder within their parent), "+ Add subtask", and
// "+ Add task". Order is priority: ⠿ or Alt+↑/↓ reorders. The row circle selects for the bulk bar.
import { computed, nextTick, ref } from 'vue'
import { rankAt } from '@/model/rank'
import type { Subtask, Task, WithId } from '@/model/types'
import type { TeamData } from '@/composables/useTeamData'
import { useTaskEdits } from '@/composables/useTaskEdits'
import { subtaskKey } from '@/composables/useSelection'
import { useTaskPanel } from '@/stores/taskPanel'
import { altMove } from '@/ui/keys'
import EditableTitle from '@/components/ui/EditableTitle.vue'
import RankHandle from '@/components/ui/RankHandle.vue'
import DraftTaskRow, { type DraftFields } from './DraftTaskRow.vue'
import TaskFieldCell, { type TaskField } from './TaskFieldCell.vue'

const props = withDefaults(
  defineProps<{
    team: TeamData
    tasks: readonly WithId<Task>[]
    columns: readonly TaskField[]
    /** Selection (omit for no circles). */
    isSelected?: (key: string) => boolean
    /** Reordering (off where the rows aren't one ordered list). */
    reorder?: boolean
    quiet?: boolean
    /** "+ Add task" at the end of the section, with these defaults. */
    newTask?: (Partial<DraftFields> & { sprintId: string | null }) | null
    /** Planning: "+ Subtask" beside Open on hover. */
    subtaskButton?: boolean
    /** Extra cells after the fields (#extra slot). */
    extra?: boolean
  }>(),
  {
    isSelected: undefined,
    reorder: true,
    quiet: false,
    newTask: null,
    subtaskButton: false,
    extra: false,
  },
)
const emit = defineEmits<{ select: [key: string, event: MouseEvent] }>()

const panel = useTaskPanel()
const edits = useTaskEdits(props.team)
const teamId = computed(() => props.team.teamId.value!)
const expanded = ref<Set<string>>(new Set())
const subtaskDraftFor = ref<string | null>(null)
const addingTask = ref(false)

const visibleSubtasks = (task: Task): Subtask[] => task.subtasks.filter((item) => !item.archived)
function toggle(task: Task & { id: string }) {
  const next = new Set(expanded.value)
  if (next.has(task.id)) next.delete(task.id)
  else next.add(task.id)
  expanded.value = next
}
async function startSubtask(task: WithId<Task>) {
  expanded.value = new Set([...expanded.value, task.id])
  subtaskDraftFor.value = task.id
}
function addSubtask(task: WithId<Task>, fields: DraftFields) {
  edits.addSub(task, {
    ...fields,
    subteamIds: fields.subteamIds.length ? fields.subteamIds : task.subteamIds,
  })
  subtaskDraftFor.value = null
}
function addTask(fields: DraftFields) {
  if (!props.newTask) return
  edits.add(
    { ...fields, sprintId: props.newTask.sprintId },
    rankAt(
      props.tasks.map((t) => t.rank),
      'bottom',
    ),
  )
}
function sprintRange(task: Task) {
  const sprint = task.sprintId ? props.team.sprintById.value.get(task.sprintId) : null
  return sprint ? { start: sprint.start, end: sprint.end, name: sprint.name } : null
}
const newTaskRange = computed(() => {
  const id = props.newTask?.sprintId
  const sprint = id ? props.team.sprintById.value.get(id) : null
  return sprint ? { start: sprint.start, end: sprint.end, name: sprint.name } : null
})

async function onTaskKeydown(event: KeyboardEvent, index: number) {
  const step = props.reorder ? altMove(event) : 0
  if (!step) return
  const task = props.tasks[index]
  edits.move(props.tasks, index, index + step)
  await nextTick()
  if (task) document.querySelector<HTMLElement>(`tr[data-task="${task.id}"] .title-button`)?.focus()
}
async function onSubtaskKeydown(event: KeyboardEvent, task: WithId<Task>, index: number) {
  const step = altMove(event)
  if (!step) return
  const list = visibleSubtasks(task)
  const item = list[index]
  edits.moveSub(task, list, index, index + step)
  await nextTick()
  if (item)
    document.querySelector<HTMLElement>(`tr[data-subtask="${item.id}"] .title-button`)?.focus()
}
const colspan = computed(() => props.columns.length + 1 + (props.extra ? 1 : 0))
</script>

<template>
  <template v-for="(task, index) in tasks" :key="task.id">
    <tr
      class="task-row"
      :class="{ selected: isSelected?.(task.id) }"
      :data-task="task.id"
      @keydown="onTaskKeydown($event, index)"
    >
      <td class="name-cell">
        <span class="name-wrap">
          <RankHandle
            v-if="reorder"
            :index="index"
            :count="tasks.length"
            :label="task.title"
            @move="edits.move(tasks, index, $event)"
          />
          <span v-else class="handle-space" />
          <button
            v-if="visibleSubtasks(task).length"
            type="button"
            class="subtask-toggle"
            :aria-expanded="expanded.has(task.id)"
            :aria-label="`${expanded.has(task.id) ? 'Hide' : 'Show'} subtasks of ${task.title}`"
            @click="toggle(task)"
          >
            {{ expanded.has(task.id) ? '▾' : '▸' }}
          </button>
          <span v-else class="toggle-space" />
          <button
            v-if="isSelected"
            type="button"
            class="select-circle"
            :aria-pressed="isSelected(task.id)"
            :aria-label="`Select ${task.title}`"
            @click="emit('select', task.id, $event)"
          />
          <EditableTitle
            class="task-title"
            :title="task.title"
            :open="false"
            @save="edits.save(task, null, { title: $event })"
          />
          <button
            v-if="visibleSubtasks(task).length"
            type="button"
            class="subtask-count"
            :title="`${visibleSubtasks(task).filter((s) => s.status === 'Done').length} of ${visibleSubtasks(task).length} subtasks done`"
            @click="toggle(task)"
          >
            {{ visibleSubtasks(task).filter((s) => s.status === 'Done').length }}/{{
              visibleSubtasks(task).length
            }}
            ☷
          </button>
          <span class="row-actions">
            <button v-if="subtaskButton" type="button" class="row-open" @click="startSubtask(task)">
              + Subtask
            </button>
            <button
              type="button"
              class="row-open"
              :aria-label="`Open ${task.title} in the side panel`"
              @click="panel.open(teamId, task.id)"
            >
              Open
            </button>
          </span>
        </span>
      </td>
      <td v-for="column in columns" :key="column" :class="`cell-${column}`">
        <TaskFieldCell :team="team" :task="task" :field="column" :quiet="quiet" />
      </td>
      <td v-if="extra" class="cell-extra"><slot name="extra" :task="task" /></td>
    </tr>

    <template v-if="expanded.has(task.id)">
      <tr
        v-for="(item, subIndex) in visibleSubtasks(task)"
        :key="item.id"
        class="subtask-row"
        :class="{
          selected: isSelected?.(subtaskKey(task.id, item.id)),
          done: item.status === 'Done',
        }"
        :data-subtask="item.id"
        @keydown="onSubtaskKeydown($event, task, subIndex)"
      >
        <td class="name-cell">
          <span class="name-wrap subtask-name">
            <RankHandle
              :index="subIndex"
              :count="visibleSubtasks(task).length"
              :label="item.title"
              @move="edits.moveSub(task, visibleSubtasks(task), subIndex, $event)"
            />
            <button
              v-if="isSelected"
              type="button"
              class="select-circle"
              :aria-pressed="isSelected(subtaskKey(task.id, item.id))"
              :aria-label="`Select ${item.title}`"
              @click="emit('select', subtaskKey(task.id, item.id), $event)"
            />
            <EditableTitle
              :title="item.title"
              :open="false"
              @save="edits.save(task, item.id, { title: $event })"
            />
            <span class="row-actions">
              <button
                type="button"
                class="row-open"
                :aria-label="`Open ${item.title} in the side panel`"
                @click="panel.open(teamId, task.id, item.id)"
              >
                Open
              </button>
            </span>
          </span>
        </td>
        <td v-for="column in columns" :key="column" :class="`cell-${column}`">
          <TaskFieldCell :team="team" :task="task" :subtask="item" :field="column" :quiet="quiet" />
        </td>
        <td v-if="extra" />
      </tr>
      <DraftTaskRow
        v-if="subtaskDraftFor === task.id"
        :team="team"
        :columns="columns"
        subtask
        :trailing="extra ? 1 : 0"
        :defaults="{ subteamIds: task.subteamIds }"
        :range="sprintRange(task)"
        @add="addSubtask(task, $event)"
        @cancel="subtaskDraftFor = null"
      />
      <tr v-else class="add-row subtask-add-row">
        <td :colspan="colspan">
          <button type="button" class="add-button subtask-add" @click="startSubtask(task)">
            + Add subtask
          </button>
        </td>
      </tr>
    </template>
  </template>

  <template v-if="newTask">
    <DraftTaskRow
      v-if="addingTask"
      :team="team"
      :columns="columns"
      :trailing="extra ? 1 : 0"
      :defaults="newTask"
      :range="newTaskRange"
      @add="addTask"
      @cancel="addingTask = false"
    />
    <tr v-else class="add-row">
      <td :colspan="colspan">
        <button type="button" class="add-button" @click="addingTask = true">+ Add task</button>
      </td>
    </tr>
  </template>
</template>
