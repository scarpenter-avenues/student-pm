<script setup lang="ts">
// The floating bar for selected rows. Planning: Move to · Status · Assign · Archive. List: Status · Assign · Archive.
// Dashboard: Status · Archive (teams have different rosters). Subtasks can be mixed in (Status, Assign, Archive apply
// to them too; Move to shows only when a task is selected, and subtasks travel with their parent).
import { computed, ref } from 'vue'
import { writes } from '@/data'
import { Timestamp } from 'firebase/firestore'
import type { Status, Subtask, Task, WithId } from '@/model/types'
import type { TeamData } from '@/composables/useTeamData'
import { parseKey } from '@/composables/useSelection'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import { plural } from '@/ui/format'
import { statusOptions } from '@/ui/options'
import ChoiceMenu from '@/components/ui/ChoiceMenu.vue'
import StatusChip from '@/components/ui/StatusChip.vue'

const props = withDefaults(
  defineProps<{
    /** Selected keys, with the team each belongs to (the dashboard mixes teams). */
    items: readonly { key: string; team: TeamData }[]
    moveTo?: boolean
    assignable?: boolean
  }>(),
  { moveTo: false, assignable: false },
)
const emit = defineEmits<{ clear: [] }>()

const toast = useToast()
const session = useSession()
const open = ref<'move' | 'status' | 'assign' | null>(null)
const moveButton = ref<HTMLButtonElement | null>(null)
const statusButton = ref<HTMLButtonElement | null>(null)
const assignButton = ref<HTMLButtonElement | null>(null)

/** Selected tasks and subtasks, grouped by task (one write per task). */
const groups = computed(() => {
  const map = new Map<
    string,
    { team: TeamData; task: WithId<Task>; whole: boolean; subtaskIds: string[] }
  >()
  props.items.forEach(({ key, team }) => {
    const { taskId, subtaskId } = parseKey(key)
    const task = team.tasks.value.find((item) => item.id === taskId)
    if (!task) return
    const id = `${team.teamId.value}/${taskId}`
    const group = map.get(id) ?? { team, task, whole: false, subtaskIds: [] }
    if (subtaskId) group.subtaskIds.push(subtaskId)
    else group.whole = true
    map.set(id, group)
  })
  return [...map.values()]
})
const hasTask = computed(() => groups.value.some((group) => group.whole))
const team = computed(() => props.items[0]?.team ?? null)
const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)

function apply(change: (task: Task | Subtask) => Partial<Subtask>) {
  groups.value.forEach(({ team: t, task, whole, subtaskIds }) => {
    const teamId = t.teamId.value!
    const subtasks = subtaskIds.length
      ? task.subtasks.map((item) =>
          subtaskIds.includes(item.id) ? { ...item, ...change(item) } : item,
        )
      : undefined
    writes
      .updateTask(teamId, task.id, {
        ...(whole ? change(task) : {}),
        ...(subtasks ? { subtasks } : {}),
      })
      .catch(fail)
  })
}

function setStatus(status: Status) {
  apply(() => ({ status }))
  toast.show(`${plural(props.items.length, 'item')} set to ${status}`)
}
function assign(uid: string) {
  if (uid === '') apply(() => ({ assigneeIds: [] }))
  else
    apply((item) => ({
      assigneeIds: item.assigneeIds.includes(uid) ? item.assigneeIds : [...item.assigneeIds, uid],
    }))
}
function move(sprintId: string | null) {
  groups.value
    .filter((group) => group.whole)
    .forEach(({ team: t, task }) =>
      writes.updateTask(t.teamId.value!, task.id, { sprintId }).catch(fail),
    )
  toast.show(
    `Moved ${plural(groups.value.filter((g) => g.whole).length, 'task')} to ${team.value?.sprintName(sprintId)}`,
  )
  emit('clear')
}
function archive() {
  const at = Timestamp.now()
  const by = session.member?.id ?? ''
  const snapshot = groups.value.map((group) => ({ ...group }))
  snapshot.forEach(({ team: t, task, whole, subtaskIds }) => {
    const teamId = t.teamId.value!
    if (whole) writes.archiveTask(teamId, task.id, t.sprintName(task.sprintId)).catch(fail)
    else
      writes
        .updateTask(teamId, task.id, {
          subtasks: task.subtasks.map((item) =>
            subtaskIds.includes(item.id) ? { ...item, archived: { by, at } } : item,
          ),
        })
        .catch(fail)
  })
  const count = props.items.length
  emit('clear')
  toast.show(`Archived ${plural(count, 'item')}`, {
    label: 'Undo',
    run: () =>
      snapshot.forEach(({ team: t, task, whole }) => {
        const teamId = t.teamId.value!
        if (whole) writes.restoreTask(teamId, task.id).catch(fail)
        else writes.updateTask(teamId, task.id, { subtasks: task.subtasks }).catch(fail)
      }),
  })
}

const sprintOptions = computed(() => [
  { value: null, label: 'Backlog', meta: '' },
  ...(team.value?.sprints.value ?? []).map((sprint) => ({
    value: sprint.id,
    label: sprint.name,
    meta: sprint.id === team.value?.currentSprint.value?.id ? 'Current' : '',
  })),
])
const peopleOptions = computed(() => [
  ...(team.value?.people.value ?? []).map((person) => ({
    value: person.id,
    label: person.displayName,
  })),
  { value: '', label: 'Unassign', meta: '' },
])
</script>

<template>
  <div v-if="items.length" class="bulk-bar" role="toolbar" aria-label="Selected tasks">
    <strong>{{ items.length }} selected</strong>
    <button
      v-if="moveTo && hasTask"
      ref="moveButton"
      type="button"
      @click="open = open === 'move' ? null : 'move'"
    >
      Move to ▾
    </button>
    <button ref="statusButton" type="button" @click="open = open === 'status' ? null : 'status'">
      Status ▾
    </button>
    <button
      v-if="assignable"
      ref="assignButton"
      type="button"
      @click="open = open === 'assign' ? null : 'assign'"
    >
      Assign ▾
    </button>
    <button type="button" class="archive" @click="archive">Archive</button>
    <button type="button" class="clear" @click="emit('clear')">Clear</button>

    <ChoiceMenu
      v-if="open === 'move'"
      :anchor="moveButton"
      heading="Move to"
      :options="sprintOptions"
      @pick="move($event as string | null)"
      @close="open = null"
    />
    <ChoiceMenu
      v-if="open === 'status'"
      :anchor="statusButton"
      :options="statusOptions"
      @pick="setStatus($event as Status)"
      @close="open = null"
    >
      <template #option="{ option }"><StatusChip :status="option.value as Status" /></template>
    </ChoiceMenu>
    <ChoiceMenu
      v-if="open === 'assign'"
      :anchor="assignButton"
      heading="Assign"
      :options="peopleOptions"
      @pick="assign($event as string)"
      @close="open = null"
    />
  </div>
</template>

<style scoped>
.bulk-bar {
  position: fixed;
  z-index: 30;
  bottom: 20px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px 8px 16px;
  border-radius: 10px;
  background: #263a34;
  color: #fff;
  box-shadow: var(--shadow);
  font-size: 13px;
  transform: translateX(-50%);
}
strong {
  margin-right: 8px;
  white-space: nowrap;
}
button {
  height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: transparent;
  color: #fff;
  font-size: 13px;
  white-space: nowrap;
}
button:hover {
  background: rgba(255, 255, 255, 0.12);
}
.archive:hover {
  background: #8b3a32;
}
.clear {
  border-color: transparent;
  color: #b9d3ca;
}
</style>
