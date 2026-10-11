<script setup lang="ts">
// List: the sprint's tasks grouped by status. Columns: Name · Status · Due date · Assignee · Subteam · Type. Drag rows
// to reorder them or into another status group.
import { computed, ref } from 'vue'
import { useTaskEdits } from '@/composables/useTaskEdits'
import { useTaskView } from '@/composables/useTaskView'
import type { Status } from '@/model/types'
import { vDragSort, type TaskDrop } from '@/ui/dragSort'
import { subtaskKey, useSelection } from '@/composables/useSelection'
import { STATUSES } from '@/ui/options'
import AnnouncementBanner from '@/components/tasks/AnnouncementBanner.vue'
import BulkBar from '@/components/tasks/BulkBar.vue'
import SprintHeader from '@/components/tasks/SprintHeader.vue'
import TaskFilterBar from '@/components/tasks/TaskFilterBar.vue'
import TaskRows from '@/components/tasks/TaskRows.vue'
import type { TaskField } from '@/components/tasks/TaskFieldCell.vue'

const { team, sprint, visible, filtered } = useTaskView(() => false)
const COLUMNS: TaskField[] = ['status', 'due', 'assignee', 'subteam', 'type']
const collapsed = ref<Set<string>>(new Set())
const edits = useTaskEdits(team)
// A row was dropped: the group it landed in becomes its status, and its place there becomes its rank.
const onDrop = (drop: TaskDrop) => edits.drop(drop, { status: drop.to as Status })

const groups = computed(() =>
  STATUSES.map((status) => ({
    status,
    tasks: visible.value.filter((task) => task.status === status),
  })).filter((group) => group.tasks.length || !filtered.value),
)
// Every selectable row from top to bottom (tasks and their subtasks), for shift-click ranges.
const order = () =>
  groups.value.flatMap((group) =>
    group.tasks.flatMap((task) => [
      task.id,
      ...task.subtasks.filter((s) => !s.archived).map((s) => subtaskKey(task.id, s.id)),
    ]),
  )
const selection = useSelection(order)
const newSprintId = computed(() =>
  sprint.value && sprint.value !== 'all' ? sprint.value.id : (team.currentSprint.value?.id ?? null),
)
// Collapses or opens a status group.
function toggleGroup(status: string) {
  const next = new Set(collapsed.value)
  if (next.has(status)) next.delete(status)
  else next.add(status)
  collapsed.value = next
}
</script>

<template>
  <AnnouncementBanner />
  <SprintHeader :sprint="sprint" picker />
  <TaskFilterBar
    :count="visible.length"
    :scope="sprint === 'all' ? 'All sprints' : 'Current sprint'"
  />
  <div class="list-view">
    <table class="task-table">
      <colgroup>
        <col />
        <col style="width: 130px" />
        <col style="width: 100px" />
        <col style="width: 170px" />
        <col style="width: 170px" />
        <col style="width: 100px" />
      </colgroup>
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Due date</th>
          <th>Assignee</th>
          <th>Subteam</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody
        v-for="group in groups"
        :key="group.status"
        v-drag-sort="{
          group: 'list',
          key: group.status,
          draggable: 'tr.task-row',
          onDrop,
          onDropSubtask: edits.dropSub,
        }"
      >
        <tr class="group-row">
          <td colspan="6">
            <button
              type="button"
              class="group-toggle"
              :aria-expanded="!collapsed.has(group.status)"
              @click="toggleGroup(group.status)"
            >
              <span class="arrow" aria-hidden="true">▾</span> {{ group.status }}
              <span class="group-count">{{ group.tasks.length }}</span>
            </button>
          </td>
        </tr>
        <TaskRows
          v-if="!collapsed.has(group.status)"
          :team="team"
          :tasks="group.tasks"
          :columns="COLUMNS"
          :is-selected="selection.has"
          :new-task="{ sprintId: newSprintId, status: group.status }"
          @select="selection.toggle"
        />
      </tbody>
    </table>
    <p v-if="!groups.length" class="empty">No tasks match these filters.</p>
  </div>
  <BulkBar
    :items="selection.keys.value.map((key) => ({ key, team }))"
    assignable
    @clear="selection.clear()"
  />
</template>

<style scoped>
.list-view {
  /* The positioning parent for a dragged row's floating copy. On iOS that copy is placed in the page, not pinned
     to the screen; without this it escapes the scroller, widens the page, and the page jumps toward the top. */
  position: relative;
  overflow-x: auto;
  border-top: 1px solid var(--line);
}
.list-view .task-table {
  min-width: 860px;
}
/* Phones: before any sideways scroll, the screen shows two columns, the name (as wide as it can be) and the status
   at the right edge. The table is the screen's width plus the columns after Status, which are a swipe away. */
@media (max-width: 680px) {
  .list-view .task-table {
    min-width: calc(100% + 540px);
  }
  .list-view .task-table col:nth-child(2) {
    width: 96px !important;
  }
}
.group-row td {
  padding: 14px 8px 8px;
  border-bottom: 1px solid var(--line);
}
.group-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #202124;
  font-size: 16px;
  font-weight: 700;
}
.arrow {
  color: #737d86;
  font-size: 12px;
  transition: transform 0.15s;
}
.group-toggle[aria-expanded='false'] .arrow {
  transform: rotate(-90deg);
}
.group-count {
  color: #8a949c;
  font-size: 13px;
  font-weight: 500;
}
.empty {
  margin: 16px 4px;
  color: var(--muted);
  font-size: 13px;
}
</style>
