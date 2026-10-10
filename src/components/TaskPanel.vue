<script setup lang="ts">
// The task side panel (ported from the mock-up's detail panel). Edits save as you go. A subtask opens here too, with
// Team › Sprint › Parent under its title, no Subtasks section, and "Make it a task". In create mode (Board's
// "+ Add task") nothing is saved until "+ Add task".
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Timestamp } from 'firebase/firestore'
import { queries, useLiveQuery, writes } from '@/data'
import { createTeamData } from '@/composables/useTeamData'
import { useTaskPanel } from '@/stores/taskPanel'
import { useToast } from '@/stores/toast'
import { useSession } from '@/stores/session'
import { addSubtask, moveSubtask, updateSubtask } from '@/model/subtasks'
import { rankAt, rankBetween } from '@/model/rank'
import type { Status, Subtask, Task, TaskType } from '@/model/types'
import { formatMoment, formatShortDate, initials } from '@/ui/format'
import { isTypeLocked, statusOptions, typeOptions } from '@/ui/options'
import { teamColorOf } from '@/ui/teamColor'
import AssigneePicker from './ui/AssigneePicker.vue'
import DateButton from './ui/DateButton.vue'
import RankHandle from './ui/RankHandle.vue'
import RichEditor from './ui/RichEditor.vue'
import SelectButton from './ui/SelectButton.vue'
import StatusChip from './ui/StatusChip.vue'
import SubteamTags from './ui/SubteamTags.vue'
import TypeLabel from './ui/TypeLabel.vue'

const panel = useTaskPanel()
const toast = useToast()
const session = useSession()
const target = computed(() => panel.target)
const team = createTeamData(() => target.value?.teamId ?? null)

const creating = computed(() => target.value?.mode === 'create')
const subtaskId = computed(() =>
  target.value?.mode === 'edit' ? (target.value.subtaskId ?? null) : null,
)
const parent = computed(() => {
  const t = target.value
  return t?.mode === 'edit' ? (team.tasks.value.find((task) => task.id === t.taskId) ?? null) : null
})
const subtask = computed(() =>
  subtaskId.value
    ? (parent.value?.subtasks.find((item) => item.id === subtaskId.value) ?? null)
    : null,
)

// ---------- the record being edited (a draft while creating) ----------
const titleInput = ref<HTMLInputElement | null>(null)
const titleDraft = ref('')

type Fields = Pick<
  Task,
  'title' | 'status' | 'type' | 'assigneeIds' | 'subteamIds' | 'start' | 'due' | 'descriptionHtml'
> & {
  sprintId: string | null
  subtasks: Subtask[]
}
const draft = reactive<Fields>({
  title: '',
  status: 'To do',
  type: 'Task',
  assigneeIds: [],
  subteamIds: [],
  start: null,
  due: null,
  descriptionHtml: '',
  sprintId: null,
  subtasks: [],
})
const record = computed<Fields | null>(() => {
  if (creating.value) return draft
  if (subtask.value && parent.value)
    return { ...subtask.value, sprintId: parent.value.sprintId, subtasks: [] }
  return parent.value
})

watch(
  target,
  async (next) => {
    if (next?.mode === 'create') {
      Object.assign(draft, {
        title: '',
        status: next.status,
        type: 'Task',
        assigneeIds: [...next.assigneeIds],
        subteamIds: [],
        start: null,
        due: null,
        descriptionHtml: '',
        sprintId: next.sprintId,
        subtasks: [],
      })
    }
    titleDraft.value = record.value?.title ?? ''
    if (next) {
      await nextTick()
      titleInput.value?.focus()
    }
  },
  { immediate: true },
)

// A task (or subtask) that disappears while open: archived elsewhere, or deleted.
watch([parent, subtask, () => team.loading.value], ([task, sub, loading]) => {
  if (target.value?.mode !== 'edit' || loading) return
  if (!task || task.archived || (subtaskId.value && (!sub || sub.archived))) panel.close()
})

function fail(error: unknown) {
  console.error(error)
  toast.show(`Couldn't save: ${(error as Error).message ?? 'unknown error'}`)
}

/** Saves fields on the open task or subtask (or the draft while creating). */
function save(changes: Partial<Fields>) {
  if (creating.value) return Object.assign(draft, changes)
  const task = parent.value
  const teamId = target.value?.teamId
  if (!task || !teamId) return
  if (subtaskId.value) {
    // Sprint and subtasks belong to the parent task.
    const fields = Object.fromEntries(
      Object.entries(changes).filter(([key]) => key !== 'sprintId' && key !== 'subtasks'),
    )
    writes
      .updateTask(teamId, task.id, {
        subtasks: updateSubtask(task.subtasks, subtaskId.value, fields),
      })
      .catch(fail)
  } else writes.updateTask(teamId, task.id, changes).catch(fail)
}

// ---------- title ----------
watch(
  () => record.value?.title,
  (title) => {
    if (document.activeElement !== titleInput.value) titleDraft.value = title ?? ''
  },
)
function saveTitle() {
  const next = titleDraft.value.replace(/\s+/g, ' ').trim()
  if (!next) {
    if (!creating.value) titleDraft.value = record.value?.title ?? ''
    return
  }
  if (next !== record.value?.title) save({ title: next })
}

// ---------- description (saved after a pause, and on close) ----------
let descriptionTimer: ReturnType<typeof setTimeout> | undefined
let pendingDescription: string | null = null
function onDescription(html: string) {
  if (creating.value) return void (draft.descriptionHtml = html)
  pendingDescription = html
  clearTimeout(descriptionTimer)
  descriptionTimer = setTimeout(flushDescription, 700)
}
function flushDescription() {
  clearTimeout(descriptionTimer)
  if (pendingDescription === null) return
  const html = pendingDescription
  pendingDescription = null
  if (html !== record.value?.descriptionHtml) save({ descriptionHtml: html })
}
onBeforeUnmount(flushDescription)

// ---------- toolbar ----------
const done = computed(() => record.value?.status === 'Done')
const typeLocked = computed(() => !!record.value && isTypeLocked(record.value.type))
const sprintLabel = computed(() => team.sprintName(record.value?.sprintId ?? null))
const sprintRange = computed(() => {
  const sprint = record.value?.sprintId ? team.sprintById.value.get(record.value.sprintId) : null
  return sprint ? { start: sprint.start, end: sprint.end, name: sprint.name } : null
})
const sprintOptions = computed(() => [
  { value: null, label: 'Backlog', meta: '' },
  ...team.sprints.value.map((sprint) => ({
    value: sprint.id,
    label: sprint.name,
    meta: sprint.id === team.currentSprint.value?.id ? 'Current' : formatShortDate(sprint.start),
  })),
])

function close() {
  flushDescription()
  saveTitle()
  panel.close()
}

function toggleComplete() {
  save({ status: done.value ? 'To do' : 'Done' })
}

async function addTask() {
  const teamId = target.value?.teamId
  const title = titleDraft.value.replace(/\s+/g, ' ').trim()
  if (!teamId) return
  if (!title) {
    toast.show('Give the task a name first.')
    titleInput.value?.focus()
    return
  }
  const ranks = team.tasks.value.map((task) => task.rank)
  const { id, written } = writes.addTask(teamId, { ...draft, title }, rankAt(ranks, 'bottom'))
  written.catch(fail)
  panel.close()
  toast.show(`Added “${title}”`, { label: 'Open', run: () => panel.open(teamId, id) })
}

function archive() {
  const teamId = target.value?.teamId
  const task = parent.value
  if (!teamId || !task) return
  if (subtaskId.value && subtask.value) {
    const id = subtaskId.value
    const archived = { by: session.member?.id ?? '', at: Timestamp.now() }
    writes
      .updateTask(teamId, task.id, { subtasks: updateSubtask(task.subtasks, id, { archived }) })
      .catch(fail)
    panel.open(teamId, task.id)
    toast.show(`Archived “${subtask.value.title}”`, {
      label: 'Undo',
      run: () => restoreSubtask(teamId, task.id, id),
    })
    return
  }
  writes.archiveTask(teamId, task.id, team.sprintName(task.sprintId)).catch(fail)
  panel.close()
  toast.show(`Archived “${task.title}”`, {
    label: 'Undo',
    run: () => writes.restoreTask(teamId, task.id).catch(fail),
  })
}
function restoreSubtask(teamId: string, taskId: string, id: string) {
  const task = team.tasks.value.find((item) => item.id === taskId)
  if (task)
    writes
      .updateTask(teamId, taskId, {
        subtasks: updateSubtask(task.subtasks, id, { archived: null }),
      })
      .catch(fail)
}

function promote() {
  const teamId = target.value?.teamId
  const task = parent.value
  const id = subtaskId.value
  if (!teamId || !task || !id) return
  // Right after its parent, in the parent's sprint.
  const index = team.tasks.value.findIndex((item) => item.id === task.id)
  const next = team.tasks.value[index + 1]
  const rank = rankBetween(task.rank, next ? next.rank : null)
  const { id: newId, written } = writes.promoteSubtask(teamId, task, id, rank)
  written.catch(fail)
  panel.open(teamId, newId)
  toast.show('It’s a task now, right after its parent.')
}

// ---------- subtasks ----------
const visibleSubtasks = computed(() =>
  (record.value?.subtasks ?? []).filter((item) => !item.archived),
)
const doneCount = computed(
  () => visibleSubtasks.value.filter((item) => item.status === 'Done').length,
)
const newSubtask = reactive({ title: '', assigneeIds: [] as string[], due: null as string | null })

function saveSubtasks(next: Subtask[]) {
  if (creating.value) return void (draft.subtasks = next)
  const teamId = target.value?.teamId
  if (teamId && parent.value)
    writes.updateTask(teamId, parent.value.id, { subtasks: next }).catch(fail)
}
function addNewSubtask() {
  const title = newSubtask.title.replace(/\s+/g, ' ').trim()
  if (!title || !record.value) return
  saveSubtasks(
    addSubtask(record.value.subtasks, {
      title,
      assigneeIds: newSubtask.assigneeIds,
      due: newSubtask.due,
      subteamIds: record.value.subteamIds,
    }),
  )
  Object.assign(newSubtask, { title: '', assigneeIds: [], due: null })
}
function setSubtaskStatus(id: string, status: Status) {
  if (record.value) saveSubtasks(updateSubtask(record.value.subtasks, id, { status }))
}
/** Moves within the visible (unarchived) list; archived subtasks keep their place. */
function moveVisibleSubtask(from: number, to: number) {
  const list = record.value?.subtasks ?? []
  const fromId = visibleSubtasks.value[from]?.id
  const toId =
    visibleSubtasks.value[Math.max(0, Math.min(to, visibleSubtasks.value.length - 1))]?.id
  const fromIndex = list.findIndex((item) => item.id === fromId)
  const toIndex = list.findIndex((item) => item.id === toId)
  if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex)
    saveSubtasks(moveSubtask(list, fromIndex, toIndex))
}
function onSubtaskKeydown(event: KeyboardEvent, index: number) {
  if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
  event.preventDefault()
  moveVisibleSubtask(index, index + (event.key === 'ArrowUp' ? -1 : 1))
}
function removeSubtask(item: Subtask) {
  const teamId = target.value?.teamId
  if (creating.value) return saveSubtasks(draft.subtasks.filter((other) => other.id !== item.id))
  if (!teamId || !parent.value) return
  const taskId = parent.value.id
  saveSubtasks(
    updateSubtask(parent.value.subtasks, item.id, {
      archived: { by: session.member?.id ?? '', at: Timestamp.now() },
    }),
  )
  toast.show(`Archived “${item.title}”`, {
    label: 'Undo',
    run: () => restoreSubtask(teamId, taskId, item.id),
  })
}
function openSubtask(item: Subtask) {
  if (creating.value || !parent.value || !target.value) return
  flushDescription()
  panel.open(target.value.teamId, parent.value.id, item.id)
}

// ---------- comments ----------
const comments = useLiveQuery(
  () =>
    !creating.value &&
    target.value?.mode === 'edit' &&
    queries.comments(target.value.teamId, target.value.taskId),
)
const shownComments = computed(() => {
  const ids = new Set((parent.value?.subtasks ?? []).map((item) => item.id))
  return comments.data.value.filter((comment) =>
    subtaskId.value
      ? comment.subtaskId === subtaskId.value
      : // The task's own comments, plus any left from a subtask that became its own task.
        comment.subtaskId === null || !ids.has(comment.subtaskId),
  )
})
const commentDraft = ref('')
function postComment() {
  const text = commentDraft.value.trim()
  const t = target.value
  if (!text || t?.mode !== 'edit') return
  writes.addComment(t.teamId, t.taskId, text, subtaskId.value).catch(fail)
  commentDraft.value = ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}
const teamMark = computed(() => teamColorOf(team.team.value?.color).bg)
const creator = computed(() =>
  parent.value && !subtaskId.value ? team.nameOf(parent.value.createdBy) : '',
)
</script>

<template>
  <div v-if="target && record" class="detail-overlay" @click.self="close" @keydown="onKeydown">
    <aside class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <header class="detail-toolbar">
        <div class="toolbar-group">
          <button v-if="creating" class="detail-complete primary" type="button" @click="addTask">
            ＋ Add task
          </button>
          <button
            v-else
            class="detail-complete"
            :class="{ done }"
            type="button"
            :aria-pressed="done"
            @click="toggleComplete"
          >
            ✓ {{ done ? 'Completed' : 'Mark complete' }}
          </button>
          <button v-if="subtaskId" class="detail-archive" type="button" @click="promote">
            Make it a task
          </button>
        </div>
        <div class="toolbar-group">
          <button v-if="!creating" class="detail-archive" type="button" @click="archive">
            Archive
          </button>
          <span v-if="creator" class="avatar" :title="`Added by ${creator}`">{{
            initials(creator)
          }}</span>
          <button class="close-button" type="button" aria-label="Close task details" @click="close">
            ×
          </button>
        </div>
      </header>

      <div class="detail-content">
        <input
          id="detail-title"
          ref="titleInput"
          v-model="titleDraft"
          class="detail-title"
          aria-label="Task name"
          maxlength="90"
          placeholder="Task name"
          @blur="saveTitle"
          @keydown.enter.prevent="(saveTitle(), titleInput?.blur())"
        />
        <div class="detail-project">
          <span class="project-mark" :style="{ background: teamMark }" />
          <strong>{{ team.team.value?.name }}</strong>
          <span>›</span>
          <span>{{ sprintLabel }}</span>
          <template v-if="subtaskId && parent">
            <span>›</span>
            <button
              type="button"
              class="parent-link"
              :aria-label="`Open parent task ${parent.title}`"
              @click="panel.open(target.teamId, parent.id)"
            >
              {{ parent.title }}
            </button>
          </template>
        </div>

        <div class="detail-properties">
          <span class="label">Assignees</span>
          <AssigneePicker
            :model-value="record.assigneeIds"
            :people="team.people.value"
            @update:model-value="save({ assigneeIds: $event })"
          />
          <span class="label">Dates</span>
          <div class="detail-dates">
            <DateButton
              class="panel-field"
              :model-value="record.start"
              label="Start date"
              placeholder="Start date"
              :max="record.due"
              :range="sprintRange"
              @update:model-value="save({ start: $event })"
            />
            <span aria-hidden="true">→</span>
            <DateButton
              class="panel-field"
              :model-value="record.due"
              label="Due date"
              placeholder="Due date"
              :min="record.start"
              :range="sprintRange"
              @update:model-value="save({ due: $event })"
            />
          </div>
          <span class="label">Status</span>
          <SelectButton
            class="panel-field"
            :model-value="record.status"
            label="Status"
            :options="statusOptions"
            @update:model-value="save({ status: $event as Status })"
          >
            <template #value="{ value }"><StatusChip :status="value as Status" /></template>
            <template #option="{ option }"
              ><StatusChip :status="option.value as Status"
            /></template>
          </SelectButton>
          <span class="label">Subteam</span>
          <SelectButton
            class="panel-field"
            :model-value="record.subteamIds"
            label="Subteams"
            multiple
            :options="team.subteams.value.map((s) => ({ value: s.id, label: s.name }))"
            @update:model-value="save({ subteamIds: $event as string[] })"
          >
            <template #value="{ value }"
              ><SubteamTags :subteams="team.subteams.value" :ids="value as string[]"
            /></template>
            <template #option="{ option }"
              ><SubteamTags :subteams="team.subteams.value" :ids="[option.value as string]"
            /></template>
          </SelectButton>
          <span class="label">Type</span>
          <SelectButton
            class="panel-field"
            :model-value="record.type"
            label="Type"
            :options="typeOptions"
            :disabled="typeLocked"
            :title="typeLocked ? 'Set by GitHub' : undefined"
            @update:model-value="save({ type: $event as TaskType })"
          >
            <template #value="{ value }"><TypeLabel :type="value as TaskType" /></template>
          </SelectButton>
          <template v-if="!subtaskId">
            <span class="label">Sprint</span>
            <SelectButton
              class="panel-field"
              :model-value="record.sprintId"
              label="Sprint"
              :options="sprintOptions"
              @update:model-value="save({ sprintId: $event as string | null })"
            >
              <template #value>{{ sprintLabel }}</template>
            </SelectButton>
          </template>
        </div>

        <h2 class="detail-section-title">Description</h2>
        <div class="detail-description">
          <RichEditor
            :key="`${target.mode}-${parent?.id}-${subtaskId}`"
            :model-value="record.descriptionHtml"
            placeholder="Add a description"
            label="Description"
            @update:model-value="onDescription"
          />
        </div>

        <section v-if="!subtaskId" class="detail-work-section" aria-labelledby="subtasks-heading">
          <div class="work-heading">
            <h2 id="subtasks-heading">Subtasks</h2>
            <span class="work-count">{{ doneCount }} / {{ visibleSubtasks.length }}</span>
          </div>
          <div class="subtask-list">
            <div
              v-for="(item, index) in visibleSubtasks"
              :key="item.id"
              class="subtask-item"
              :class="{ completed: item.status === 'Done' }"
              @keydown="onSubtaskKeydown($event, index)"
            >
              <RankHandle
                :index="index"
                :count="visibleSubtasks.length"
                :label="item.title"
                @move="moveVisibleSubtask(index, $event)"
              />
              <button
                type="button"
                class="subtask-title"
                :disabled="creating"
                @click="openSubtask(item)"
              >
                {{ item.title }}
              </button>
              <SelectButton
                class="subtask-status"
                :model-value="item.status"
                :label="`Status of ${item.title}`"
                :options="statusOptions"
                @update:model-value="setSubtaskStatus(item.id, $event as Status)"
              >
                <template #value="{ value }"><StatusChip :status="value as Status" /></template>
                <template #option="{ option }"
                  ><StatusChip :status="option.value as Status"
                /></template>
              </SelectButton>
              <button
                type="button"
                class="subtask-remove"
                :aria-label="`Archive ${item.title}`"
                title="Archive"
                @click="removeSubtask(item)"
              >
                ×
              </button>
              <span class="subtask-meta">
                {{
                  item.assigneeIds.length
                    ? item.assigneeIds.map(team.nameOf).join(', ')
                    : 'Unassigned'
                }}
                <template v-if="item.due"> · {{ formatShortDate(item.due) }}</template>
              </span>
            </div>
            <p v-if="!visibleSubtasks.length" class="empty">No subtasks yet.</p>
          </div>
          <form class="subtask-form" @submit.prevent="addNewSubtask">
            <input
              v-model="newSubtask.title"
              maxlength="90"
              placeholder="Subtask name"
              aria-label="New subtask name"
            />
            <AssigneePicker
              v-model="newSubtask.assigneeIds"
              :people="team.people.value"
              placeholder="Assign…"
              label="Subtask assignees"
            />
            <DateButton
              v-model="newSubtask.due"
              class="panel-field bordered"
              label="Subtask due date"
              placeholder="Due date"
              :range="sprintRange"
            />
            <button type="submit" class="add-button">Add</button>
          </form>
        </section>

        <section v-if="!creating" class="detail-work-section" aria-labelledby="comments-heading">
          <div class="work-heading">
            <h2 id="comments-heading">Comments</h2>
            <span class="work-count">{{ shownComments.length }}</span>
          </div>
          <p class="comment-policy">
            Comments are visible to the whole team. Keep notes about this task; this isn’t a private
            message channel.
          </p>
          <div class="comment-list">
            <article v-for="comment in shownComments" :key="comment.id" class="comment-item">
              <div class="comment-meta">
                <strong>{{ team.nameOf(comment.authorId) }}</strong>
                <time>{{ formatMoment(comment.createdAt) }}</time>
              </div>
              <p v-if="comment.subtaskId && !subtaskId" class="former">From a former subtask</p>
              <p>{{ comment.text }}</p>
            </article>
          </div>
          <form class="comment-form" @submit.prevent="postComment">
            <textarea
              v-model="commentDraft"
              maxlength="2000"
              placeholder="Add a task-related comment"
              aria-label="Task-related comment"
              @keydown.meta.enter="postComment"
              @keydown.ctrl.enter="postComment"
            />
            <button class="comment-submit" type="submit" :disabled="!commentDraft.trim()">
              Post comment
            </button>
          </form>
        </section>
      </div>
      <footer class="detail-footer"><button type="button" @click="close">Close</button></footer>
    </aside>
  </div>
</template>

<style scoped>
.detail-overlay {
  position: fixed;
  z-index: 35;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background: rgba(22, 32, 29, 0.22);
}
.detail-panel {
  display: flex;
  flex-direction: column;
  width: min(620px, 58vw);
  min-width: 420px;
  height: 100%;
  background: #fff;
  box-shadow: -12px 0 34px rgba(28, 43, 37, 0.13);
  animation: panel-in 0.18s ease-out;
}
@keyframes panel-in {
  from {
    transform: translateX(24px);
    opacity: 0.6;
  }
}
.detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 53px;
  padding: 0 20px;
  border-bottom: 1px solid var(--line);
}
.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-complete,
.detail-archive {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: #53615b;
  font-size: 13px;
}
.detail-complete.done {
  border-color: #b7dfc6;
  background: #e6f5eb;
  color: #267b49;
}
.detail-complete.primary {
  border-color: #356fd1;
  background: #356fd1;
  color: #fff;
  font-weight: 650;
}
.detail-archive:hover {
  border-color: #e2b8b2;
  background: #fbeeec;
  color: #a43d34;
}
.avatar {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: #e2ece6;
  color: #27654f;
  font-size: 9px;
  font-weight: 800;
}
.close-button {
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #4d5962;
  font-size: 28px;
  line-height: 1;
}
.close-button:hover {
  background: #f1f4f8;
}
.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 22px 26px 30px;
}
.detail-title {
  width: 100%;
  margin: 0 0 23px;
  padding: 2px 0 7px;
  border: 0;
  border-bottom: 1px solid transparent;
  outline: 0;
  font-size: 26px;
  font-weight: 700;
}
.detail-title:focus {
  border-color: var(--team-line);
}
.detail-project {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: -16px 0 20px;
  color: #65716c;
  font-size: 13px;
}
.project-mark {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  border-radius: 4px;
}
.parent-link {
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2864c7;
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.parent-link:hover {
  text-decoration: underline;
}
.detail-properties {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  align-items: center;
  gap: 2px 12px;
  margin-bottom: 28px;
}
.label {
  padding: 10px 0;
  color: #65716c;
  font-size: 13px;
  font-weight: 650;
}
.detail-properties :deep(.panel-field) {
  width: 100%;
  min-height: 34px;
  border-color: transparent;
  background-color: #fff;
}
.detail-properties :deep(.panel-field:hover),
.detail-properties :deep(.panel-field:focus-visible) {
  border-color: var(--line);
  outline: none;
}
.detail-properties :deep(.panel-field:disabled:hover) {
  border-color: transparent;
}
.detail-properties :deep(.assignee-picker) {
  border-color: transparent;
}
.detail-properties :deep(.assignee-picker:hover) {
  border-color: var(--line);
}
.detail-dates {
  display: flex;
  align-items: center;
  gap: 6px;
}
.detail-dates > span {
  color: #8a949c;
}
.detail-dates :deep(.panel-field) {
  flex: 1;
  min-width: 0;
}
.detail-section-title {
  margin: 0 0 11px;
  font-size: 15px;
}
.detail-description {
  padding: 4px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.detail-description :deep(.rich-content) {
  min-height: 110px;
  padding: 6px 0 10px;
  font-size: 14px;
}
.detail-work-section {
  margin-top: 25px;
  padding-top: 19px;
  border-top: 1px solid var(--line);
}
.work-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 11px;
}
.work-heading h2 {
  margin: 0;
  font-size: 17px;
}
.work-count {
  color: #737d86;
  font-size: 12px;
}
.subtask-list,
.comment-list {
  display: grid;
  gap: 7px;
}
.subtask-item {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 2px 8px;
  min-height: 42px;
  padding: 5px 8px;
  border: 1px solid #edf0f3;
  border-radius: 5px;
}
.subtask-item:hover :deep(.rank-handle),
.subtask-item:focus-within :deep(.rank-handle) {
  opacity: 1;
}
.subtask-title {
  min-width: 0;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: #303941;
  font: inherit;
  font-size: 14px;
  text-align: left;
}
.subtask-title:hover:not(:disabled) {
  color: #2864c7;
  text-decoration: underline;
}
.subtask-title:disabled {
  cursor: default;
}
.completed .subtask-title {
  color: #828a91;
  text-decoration: line-through;
}
.subtask-item :deep(.subtask-status) {
  min-height: 26px;
  height: 26px;
  padding-left: 4px;
  border-color: transparent;
  background-color: transparent;
}
.subtask-item :deep(.subtask-status:hover) {
  border-color: #d5dce5;
  background-color: #fff;
}
.subtask-remove {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #737d86;
  font-size: 17px;
}
.subtask-remove:hover {
  background: #f3f5f8;
  color: #a43d34;
}
.subtask-meta {
  grid-column: 2 / -1;
  color: #737d86;
  font-size: 12px;
}
.empty {
  margin: 0;
  padding: 8px 0;
  color: #737d86;
  font-size: 13px;
}
.subtask-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(130px, 0.7fr) auto auto;
  align-items: start;
  gap: 7px;
  margin-top: 9px;
}
.subtask-form input {
  min-width: 0;
  min-height: 36px;
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  font-size: 13px;
}
.subtask-form :deep(.panel-field) {
  min-height: 36px;
}
.add-button,
.comment-submit {
  min-height: 36px;
  padding: 0 11px;
  border: 1px solid #356fd1;
  border-radius: 5px;
  background: #356fd1;
  color: #fff;
  font-size: 13px;
  font-weight: 650;
}
.comment-submit:disabled {
  opacity: 0.55;
  cursor: default;
}
.comment-policy {
  margin: -3px 0 12px;
  color: #737d86;
  font-size: 12px;
  line-height: 1.45;
}
.comment-item {
  padding: 10px;
  border: 1px solid #edf0f3;
  border-radius: 6px;
}
.comment-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 5px;
}
.comment-meta strong {
  font-size: 13px;
}
.comment-meta time {
  color: #818991;
  font-size: 11px;
}
.comment-item p {
  margin: 0;
  color: #3f474e;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.comment-item .former {
  margin-bottom: 4px;
  color: #8a949c;
  font-size: 12px;
}
.comment-form {
  display: grid;
  justify-items: end;
  gap: 8px;
  margin-top: 11px;
}
.comment-form textarea {
  width: 100%;
  min-height: 80px;
  resize: vertical;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
}
.comment-form textarea:focus,
.subtask-form input:focus {
  border-color: var(--team-line);
  outline: 2px solid var(--team-soft);
}
.detail-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 45px;
  padding: 0 20px;
  border-top: 1px solid var(--line);
}
.detail-footer button {
  border: 0;
  background: transparent;
  color: #75817b;
  font-size: 13px;
}
@media (max-width: 680px) {
  .detail-panel {
    width: 100%;
    min-width: 0;
  }
  .detail-content {
    padding: 19px 17px 26px;
  }
  .detail-title {
    font-size: 22px;
  }
  .detail-properties {
    grid-template-columns: 90px minmax(0, 1fr);
  }
  .subtask-form {
    grid-template-columns: 1fr 1fr;
  }
  .subtask-form input:first-child {
    grid-column: 1 / -1;
  }
}
</style>
