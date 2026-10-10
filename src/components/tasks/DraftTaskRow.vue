<script setup lang="ts">
// A new task (or subtask) row: a name box lined up under the row circles, then the same themed controls as the cells.
// Add / Cancel sit at the right end of the name cell; Enter adds, Esc cancels. Type starts as "Task".
import { nextTick, onMounted, reactive, ref } from 'vue'
import type { Status, TaskType } from '@/model/types'
import type { TeamData } from '@/composables/useTeamData'
import { statusOptions, typeOptions } from '@/ui/options'
import AssigneePicker from '@/components/ui/AssigneePicker.vue'
import DateButton from '@/components/ui/DateButton.vue'
import SelectButton from '@/components/ui/SelectButton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import SubteamTags from '@/components/ui/SubteamTags.vue'
import TypeLabel from '@/components/ui/TypeLabel.vue'
import type { TaskField } from './TaskFieldCell.vue'

export interface DraftFields {
  title: string
  status: Status
  due: string | null
  assigneeIds: string[]
  subteamIds: string[]
  type: TaskType
}

const props = withDefaults(
  defineProps<{
    team: TeamData
    columns: readonly TaskField[]
    subtask?: boolean
    defaults?: Partial<DraftFields>
    /** Extra empty cells after the fields (e.g. Planning's Move to). */
    trailing?: number
    range?: { start: string; end: string; name?: string } | null
  }>(),
  { subtask: false, defaults: () => ({}), trailing: 0, range: null },
)
const emit = defineEmits<{ add: [fields: DraftFields]; cancel: [] }>()

const fields = reactive<DraftFields>({
  title: '',
  status: 'To do',
  due: null,
  assigneeIds: [],
  subteamIds: [],
  type: 'Task',
  ...props.defaults,
})
const input = ref<HTMLInputElement | null>(null)
onMounted(async () => {
  await nextTick()
  input.value?.focus()
})

function add() {
  const title = fields.title.replace(/\s+/g, ' ').trim()
  if (!title) return input.value?.focus()
  emit('add', { ...fields, title })
  // Tasks: stay open for the next one. Subtasks: close (the parent shows the new one).
  fields.title = ''
  input.value?.focus()
}
function onKeydown(event: KeyboardEvent) {
  if (
    event.key === 'Enter' &&
    (event.target as HTMLElement).tagName === 'INPUT' &&
    event.target === input.value
  ) {
    event.preventDefault()
    add()
  } else if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    emit('cancel')
  }
}
</script>

<template>
  <tr class="draft-row" :class="{ 'draft-subtask': subtask }" @keydown="onKeydown">
    <td class="name-cell">
      <div class="draft-name">
        <input
          ref="input"
          v-model="fields.title"
          maxlength="90"
          :placeholder="subtask ? 'Subtask name' : 'Task name'"
          :aria-label="subtask ? 'New subtask name' : 'New task name'"
        />
        <button type="button" class="draft-add" @click="add">Add</button>
        <button type="button" class="draft-cancel" @click="emit('cancel')">Cancel</button>
      </div>
    </td>
    <td v-for="column in columns" :key="column">
      <SelectButton
        v-if="column === 'status'"
        v-model="fields.status"
        class="draft-field"
        label="Status"
        :options="statusOptions"
      >
        <template #value="{ value }"><StatusChip :status="value as Status" /></template>
        <template #option="{ option }"><StatusChip :status="option.value as Status" /></template>
      </SelectButton>
      <DateButton
        v-else-if="column === 'due'"
        v-model="fields.due"
        class="draft-field"
        label="Due date"
        placeholder="Due"
        :range="range"
      />
      <AssigneePicker
        v-else-if="column === 'assignee'"
        v-model="fields.assigneeIds"
        :people="team.people.value"
        placeholder="Assign…"
        class="draft-assignees"
      />
      <SelectButton
        v-else-if="column === 'subteam'"
        v-model="fields.subteamIds"
        class="draft-field"
        label="Subteams"
        multiple
        :options="team.subteams.value.map((s) => ({ value: s.id, label: s.name }))"
      >
        <template #value="{ value }"
          ><SubteamTags :subteams="team.subteams.value" :ids="value as string[]"
        /></template>
        <template #option="{ option }"
          ><SubteamTags :subteams="team.subteams.value" :ids="[option.value as string]"
        /></template>
      </SelectButton>
      <SelectButton
        v-else-if="column === 'type'"
        v-model="fields.type"
        class="draft-field"
        label="Type"
        :options="typeOptions"
      >
        <template #value="{ value }"><TypeLabel :type="value as TaskType" /></template>
      </SelectButton>
    </td>
    <td v-for="n in trailing" :key="`t${n}`" />
  </tr>
</template>

<style scoped>
.draft-row td {
  padding-top: 6px !important;
  padding-bottom: 6px !important;
  background: var(--team-softer);
  vertical-align: middle;
}
.draft-name {
  display: flex;
  align-items: center;
  gap: 6px;
  /* Lined up under the row circles above. */
  padding-left: var(--name-indent, 34px);
}
.draft-subtask .draft-name {
  padding-left: var(--subtask-indent, 60px);
}
.draft-name input {
  flex: 1;
  min-width: 80px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid #82a8e8;
  border-radius: 5px;
  font: inherit;
}
.draft-add,
.draft-cancel {
  flex: 0 0 auto;
  height: 28px;
  padding: 0 9px;
  border: 1px solid #d5dce5;
  border-radius: 5px;
  background: #fff;
  color: #4d5962;
  font-size: 12px;
}
.draft-add {
  border-color: #356fd1;
  background: #356fd1;
  color: #fff;
  font-weight: 650;
}
/* Status and Subteam show just their chips (a box on hover). */
.draft-field {
  min-height: 28px;
  border-color: transparent;
  background-color: transparent;
}
.draft-field:hover,
.draft-field[aria-expanded='true'] {
  border-color: #d5dce5;
  background-color: #fff;
}
.draft-assignees {
  min-height: 30px;
  padding: 1px 4px;
}
</style>
