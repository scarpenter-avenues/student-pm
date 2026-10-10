<script setup lang="ts">
// Board, and My Tasks (`mine`): three columns tinted with the team color, exactly one screen tall, each scrolling on
// its own. My Tasks is deliberately the simplest view: the current sprint, assigned to you, no filters, every column
// kept so there's always somewhere to add a task. Drag cards to reorder them or to another column (status).
import { computed, nextTick } from 'vue'
import { writes } from '@/data'
import { rankBetween } from '@/model/rank'
import type { Status, Task, WithId } from '@/model/types'
import { useTaskEdits } from '@/composables/useTaskEdits'
import { useTaskView } from '@/composables/useTaskView'
import { useSession } from '@/stores/session'
import { useTaskPanel } from '@/stores/taskPanel'
import { useToast } from '@/stores/toast'
import { vDragSort, type TaskDrop } from '@/ui/dragSort'
import { STATUSES } from '@/ui/options'
import AnnouncementBanner from '@/components/tasks/AnnouncementBanner.vue'
import SprintHeader from '@/components/tasks/SprintHeader.vue'
import TaskCard from '@/components/tasks/TaskCard.vue'
import TaskFilterBar from '@/components/tasks/TaskFilterBar.vue'

const props = defineProps<{ mine?: boolean }>()

const { team, sprint, visible, filtered } = useTaskView(() => !!props.mine)
const session = useSession()
const panel = useTaskPanel()
const toast = useToast()
const edits = useTaskEdits(team)
const onDrop = (drop: TaskDrop) => edits.drop(drop, { status: drop.to as Status })

const columns = computed(() =>
  STATUSES.map((status) => ({
    status,
    key: status === 'To do' ? 'todo' : status === 'In progress' ? 'inprogress' : 'done',
    tasks: visible.value.filter((task) => task.status === status),
  })).filter((column) => props.mine || !filtered.value || column.tasks.length),
)

const scope = computed(() =>
  props.mine ? 'Assigned to you' : sprint.value === 'all' ? 'All sprints' : 'Current sprint',
)

function addTask(status: Status) {
  const teamId = team.teamId.value
  if (!teamId) return
  const shown = sprint.value
  const sprintId = shown && shown !== 'all' ? shown.id : (team.currentSprint.value?.id ?? null)
  panel.create(teamId, sprintId, status, props.mine && session.member ? [session.member.id] : [])
}

/** Alt+↑/↓ on a card: swap with its neighbor in the column (ranks are shared, so place it just past the neighbor). */
async function move(list: WithId<Task>[], index: number, step: -1 | 1) {
  const neighbor = list[index + step]
  const task = list[index]
  if (!neighbor || !task || !team.teamId.value) return
  const all = team.tasks.value
  const at = all.findIndex((item) => item.id === neighbor.id)
  const rank =
    step < 0
      ? rankBetween(all[at - 1]?.rank ?? null, neighbor.rank)
      : rankBetween(neighbor.rank, all[at + 1]?.rank ?? null)
  writes
    .updateTask(team.teamId.value, task.id, { rank })
    .catch((error: Error) => toast.show(`Couldn't move: ${error.message}`))
  await nextTick()
  document.querySelector<HTMLElement>(`[data-task="${task.id}"]`)?.focus()
}
</script>

<template>
  <AnnouncementBanner />
  <SprintHeader :sprint="sprint" :picker="!mine" />
  <TaskFilterBar :count="visible.length" :scope="scope" :show-filters="!mine" />
  <div class="board" :class="{ mine }">
    <section v-for="column in columns" :key="column.status" class="column" :data-state="column.key">
      <header class="column-head">
        <span class="column-name">{{ column.status }}</span>
        <span class="column-count">{{ column.tasks.length }}</span>
      </header>
      <div
        v-drag-sort="{ group: 'board', key: column.status, draggable: '.task-card', onDrop }"
        class="task-list"
      >
        <TaskCard
          v-for="(task, index) in column.tasks"
          :key="task.id"
          :task="task"
          @move="move(column.tasks, index, $event)"
        />
        <p v-if="!column.tasks.length && team.loading.value" class="loading">Loading…</p>
      </div>
      <button class="add-task" type="button" @click="addTask(column.status)">＋ Add task</button>
    </section>
    <p v-if="!columns.length" class="no-match">No tasks match these filters.</p>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 12px;
  /* Exactly one screen: scrolled to the bottom, the column titles sit just under the top bar. */
  height: calc(100vh - var(--topbar-h) - 24px);
  min-height: 420px;
  padding-bottom: 12px;
  overflow-x: auto;
}
.column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 0 9px 9px;
  border-radius: 9px;
  background: var(--team-wash);
}
.column-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 4px;
}
.column-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 750;
}
.column-name::before {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  background: #9aa0a6;
  content: '';
}
[data-state='inprogress'] .column-name::before {
  background: #e49332;
}
[data-state='done'] .column-name::before {
  background: #35a267;
}
.column-count {
  color: #97a09f;
  font-size: 12px;
}
.task-list {
  display: grid;
  flex: 1 1 auto;
  align-content: start;
  gap: 8px;
  min-height: 0;
  padding: 2px 2px 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.add-task {
  flex: 0 0 auto;
  width: 100%;
  min-height: 40px;
  margin-top: 7px;
  padding: 0 10px;
  border: 1px dashed var(--team-line);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.55);
  color: #76837d;
  font-size: 14px;
  text-align: left;
}
.add-task:hover {
  background: #fff;
  color: var(--team-ink);
}
.loading,
.no-match {
  margin: 8px 4px;
  color: var(--muted);
  font-size: 13px;
}
@media (max-width: 680px) {
  .board {
    grid-template-columns: repeat(3, minmax(82vw, 1fr));
    scroll-snap-type: x mandatory;
  }
  .column {
    scroll-snap-align: start;
  }
}
</style>
