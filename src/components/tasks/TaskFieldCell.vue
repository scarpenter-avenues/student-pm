<script setup lang="ts">
// One editable cell in a task table: Status, Due date, Assignee, Subteam, or Type. Clicking opens a themed popover
// anchored to the cell (the same chips as the table), so column widths never shift. A GitHub issue's type is locked.
import { computed, ref } from 'vue'
import type { Status, Subtask, Task, TaskType, WithId } from '@/model/types'
import type { TeamData } from '@/composables/useTeamData'
import { useTaskEdits } from '@/composables/useTaskEdits'
import { formatShortDate } from '@/ui/format'
import { isTypeLocked, statusOptions, typeOptions } from '@/ui/options'
import AvatarStack from '@/components/ui/AvatarStack.vue'
import CalendarPopover from '@/components/ui/CalendarPopover.vue'
import ChoiceMenu from '@/components/ui/ChoiceMenu.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import SubteamTags from '@/components/ui/SubteamTags.vue'
import TypeLabel from '@/components/ui/TypeLabel.vue'
import AssigneePopover from './AssigneePopover.vue'

export type TaskField = 'status' | 'due' | 'assignee' | 'subteam' | 'type'

const props = withDefaults(
  defineProps<{
    team: TeamData
    task: WithId<Task>
    subtask?: Subtask | null
    field: TaskField
    /** Planning's quiet defaults: "—" instead of "Unassigned". */
    quiet?: boolean
  }>(),
  { subtask: null, quiet: false },
)

const edits = useTaskEdits(props.team)
const record = computed(() => props.subtask ?? props.task)
const button = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const locked = computed(() => props.field === 'type' && isTypeLocked(record.value.type))
const names = computed(() => record.value.assigneeIds.map(props.team.nameOf))
const sprintRange = computed(() => {
  const sprint = props.task.sprintId ? props.team.sprintById.value.get(props.task.sprintId) : null
  return sprint ? { start: sprint.start, end: sprint.end, name: sprint.name } : null
})
const label = computed(
  () =>
    `${{ status: 'Status', due: 'Due date', assignee: 'Assignees', subteam: 'Subteams', type: 'Type' }[props.field]} of ${record.value.title}`,
)

function save(changes: Partial<Subtask>) {
  edits.save(props.task, props.subtask?.id ?? null, changes)
}
</script>

<template>
  <button
    ref="button"
    type="button"
    class="cell-button"
    :class="[field, { locked }]"
    :aria-label="label"
    :aria-haspopup="locked ? undefined : field === 'due' ? 'dialog' : 'menu'"
    aria-expanded="false"
    :disabled="locked"
    :title="locked ? 'Set by GitHub' : undefined"
    @click.stop="open = !open"
  >
    <StatusChip v-if="field === 'status'" :status="record.status" />
    <span v-else-if="field === 'due'" :class="{ none: !record.due }">{{
      formatShortDate(record.due)
    }}</span>
    <span
      v-else-if="field === 'assignee'"
      class="assignee"
      :class="{ none: !names.length }"
      :title="names.join(', ')"
    >
      <template v-if="names.length">
        <AvatarStack :names="names" :max="2" />
        <span class="names">{{
          names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
        }}</span>
      </template>
      <template v-else-if="quiet">—</template>
      <template v-else><AvatarStack :names="[]" /> <span class="names">Unassigned</span></template>
    </span>
    <SubteamTags
      v-else-if="field === 'subteam'"
      :subteams="team.subteams.value"
      :ids="record.subteamIds"
    />
    <TypeLabel v-else :type="record.type" />
  </button>

  <ChoiceMenu
    v-if="open && field === 'status'"
    :anchor="button"
    :options="statusOptions"
    :selected="record.status"
    @pick="save({ status: $event as Status })"
    @close="open = false"
  >
    <template #option="{ option }"><StatusChip :status="option.value as Status" /></template>
  </ChoiceMenu>
  <ChoiceMenu
    v-else-if="open && field === 'type'"
    :anchor="button"
    :options="typeOptions"
    :selected="record.type"
    @pick="save({ type: $event as TaskType })"
    @close="open = false"
  />
  <ChoiceMenu
    v-else-if="open && field === 'subteam'"
    :anchor="button"
    :options="team.subteams.value.map((s) => ({ value: s.id, label: s.name }))"
    :selected="record.subteamIds"
    multiple
    @change="save({ subteamIds: $event as string[] })"
    @close="open = false"
  >
    <template #option="{ option }"
      ><SubteamTags :subteams="team.subteams.value" :ids="[option.value as string]"
    /></template>
  </ChoiceMenu>
  <CalendarPopover
    v-else-if="open && field === 'due'"
    :anchor="button"
    :label="label"
    :selected="record.due"
    :range="sprintRange"
    :min="record.start"
    :actions="record.due ? [{ label: 'Clear date', run: () => save({ due: null }) }] : []"
    @pick="(save({ due: $event }), (open = false))"
    @close="open = false"
  />
  <AssigneePopover
    v-else-if="open && field === 'assignee'"
    :anchor="button"
    :ids="record.assigneeIds"
    :people="team.people.value"
    :label="label"
    @change="save({ assigneeIds: $event })"
    @close="open = false"
  />
</template>

<style scoped>
.cell-button {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 26px;
  padding: 2px 4px;
  margin-left: -5px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}
.cell-button:hover:not(:disabled),
.cell-button[aria-expanded='true'] {
  border-color: #d5dce5;
  background: #fff;
}
.cell-button:disabled {
  cursor: default;
}
.assignee {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.names {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.none {
  color: #9aa3aa;
}
</style>
