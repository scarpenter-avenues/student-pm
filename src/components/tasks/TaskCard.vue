<script setup lang="ts">
// A Board card: title (renames in place; Open on hover), subteam tags, assignees, due date, and the subtasks, which
// expand to a checklist (a square checkbox to the right: Done ↔ To do) with "+ Add subtask". New subtasks for a
// task without any are added in the side panel.
import { computed, nextTick, ref } from 'vue'
import { writes } from '@/data'
import { addSubtask, updateSubtask } from '@/model/subtasks'
import type { Subtask, Task, WithId } from '@/model/types'
import { useTeam } from '@/composables/useTeamData'
import { useTaskPanel } from '@/stores/taskPanel'
import { useToast } from '@/stores/toast'
import { formatShortDate } from '@/ui/format'
import AvatarStack from '@/components/ui/AvatarStack.vue'
import EditableTitle from '@/components/ui/EditableTitle.vue'
import SubteamTags from '@/components/ui/SubteamTags.vue'

const props = defineProps<{ task: WithId<Task> }>()
const emit = defineEmits<{ move: [step: -1 | 1] }>()

const team = useTeam()
const panel = useTaskPanel()
const toast = useToast()
const teamId = computed(() => team.teamId.value!)

const subtasks = computed(() => props.task.subtasks.filter((item) => !item.archived))
const doneCount = computed(() => subtasks.value.filter((item) => item.status === 'Done').length)
const expanded = ref(false)
const names = computed(() => props.task.assigneeIds.map(team.nameOf))
const assigneeLabel = computed(() =>
  !names.value.length
    ? 'Unassigned'
    : names.value.length === 1
      ? names.value[0]
      : `${names.value[0]} +${names.value.length - 1}`,
)

const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)
function rename(title: string) {
  writes.updateTask(teamId.value, props.task.id, { title }).catch(fail)
}
function toggleSubtask(item: Subtask) {
  const status = item.status === 'Done' ? 'To do' : 'Done'
  writes
    .updateTask(teamId.value, props.task.id, {
      subtasks: updateSubtask(props.task.subtasks, item.id, { status }),
    })
    .catch(fail)
}

// ---------- + Add subtask ----------
const drafting = ref(false)
const draftTitle = ref('')
const draftInput = ref<HTMLInputElement | null>(null)
async function startDraft() {
  expanded.value = true
  drafting.value = true
  await nextTick()
  draftInput.value?.focus()
}
function saveDraft() {
  const title = draftTitle.value.replace(/\s+/g, ' ').trim()
  if (title) {
    writes
      .updateTask(teamId.value, props.task.id, {
        subtasks: addSubtask(props.task.subtasks, { title, subteamIds: props.task.subteamIds }),
      })
      .catch(fail)
  }
  draftTitle.value = ''
  drafting.value = false
}
function onDraftKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key === 'Enter') {
    event.preventDefault()
    saveDraft()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    draftTitle.value = ''
    drafting.value = false
  }
}
function onKeydown(event: KeyboardEvent) {
  if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
  event.preventDefault()
  emit('move', event.key === 'ArrowUp' ? -1 : 1)
}
</script>

<template>
  <article class="task-card" tabindex="-1" :data-task="task.id" @keydown="onKeydown">
    <h3>
      <EditableTitle :title="task.title" @save="rename" @open="panel.open(teamId, task.id)" />
    </h3>
    <SubteamTags
      v-if="task.subteamIds.length"
      class="tag-row"
      :subteams="team.subteams.value"
      :ids="task.subteamIds"
    />
    <div class="task-footer">
      <span class="assignee" :title="names.join(', ')">
        <AvatarStack :names="names" :max="2" />
        <span :class="{ muted: !names.length }">{{ assigneeLabel }}</span>
      </span>
      <span v-if="task.due" class="task-due">{{ formatShortDate(task.due) }}</span>
    </div>
    <div v-if="subtasks.length || drafting" class="card-subtasks">
      <div v-if="subtasks.length" class="subtask-bar">
        <button
          type="button"
          class="subtask-toggle"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{ doneCount }}/{{ subtasks.length }} <span aria-hidden="true">☷</span>
          <span class="caret" aria-hidden="true">{{ expanded ? '▾' : '▸' }}</span>
          <span class="sr-only">subtasks</span>
        </button>
      </div>
      <div v-if="expanded" class="subtask-list">
        <div
          v-for="item in subtasks"
          :key="item.id"
          class="subtask-row"
          :class="{ completed: item.status === 'Done' }"
        >
          <button type="button" class="subtask-open" @click="panel.open(teamId, task.id, item.id)">
            {{ item.title }}
          </button>
          <input
            type="checkbox"
            class="subtask-done"
            :checked="item.status === 'Done'"
            :aria-label="`${item.title} done`"
            @change="toggleSubtask(item)"
          />
        </div>
        <div v-if="drafting" class="subtask-draft">
          <input
            ref="draftInput"
            v-model="draftTitle"
            maxlength="90"
            placeholder="Subtask name"
            aria-label="New subtask name"
            @keydown="onDraftKeydown"
            @blur="saveDraft"
          />
        </div>
        <button v-else type="button" class="subtask-add" @click="startDraft">+ Add subtask</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.task-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  column-gap: 10px;
  width: 100%;
  padding: 14px;
  border: 1px solid #d8dde3;
  border-radius: 7px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(32, 45, 61, 0.06);
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease;
}
.task-card:hover {
  transform: translateY(-2px);
  border-color: var(--team-line);
  box-shadow: 0 5px 14px rgba(31, 50, 45, 0.07);
}
.task-card:focus-visible {
  outline: 2px solid #82a8e8;
}
h3 {
  grid-column: 1;
  min-width: 0;
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.5;
}
h3 :deep(.editable-title) {
  display: flex;
  align-items: flex-start;
}
h3 :deep(.title-button) {
  white-space: normal;
}
.tag-row {
  grid-column: 2;
  grid-row: 1;
  justify-content: flex-end;
}
.task-footer,
.card-subtasks {
  grid-column: 1 / -1;
}
.task-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 23px;
  padding-top: 8px;
  border-top: 1px solid #f0f2f0;
}
.assignee {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: #768188;
  font-size: 13px;
}
.assignee > span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.muted {
  color: #9aa3aa;
}
.task-due {
  flex: 0 0 auto;
  color: #899391;
  font-size: 12px;
}
.subtask-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
.subtask-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #6c7780;
  font-size: 12px;
}
.subtask-toggle:hover {
  background: #f3f6fa;
  color: #356fd1;
}
.subtask-list {
  display: grid;
  border-top: 1px solid #edf0f3;
}
.subtask-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 37px;
  padding: 5px 3px;
  border-bottom: 1px solid #edf0f3;
}
.subtask-open {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: #3f474e;
  font-size: 13px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.subtask-open:hover {
  color: #2864c7;
}
.completed .subtask-open {
  color: #828a91;
  text-decoration: line-through;
}
.subtask-done {
  flex: 0 0 auto;
  width: 15px;
  height: 15px;
  margin: 0 2px 0 0;
  accent-color: var(--green);
  cursor: pointer;
}
.subtask-add {
  min-height: 30px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: #68747e;
  font-size: 13px;
  text-align: left;
}
.subtask-add:hover {
  color: #2864c7;
}
.subtask-draft {
  padding: 7px 0;
}
.subtask-draft input {
  width: 100%;
  height: 32px;
  padding: 5px 7px;
  border: 1px solid #d5dce5;
  border-radius: 5px;
  font-size: 13px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
