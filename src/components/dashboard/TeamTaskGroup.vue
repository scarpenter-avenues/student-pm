<script setup lang="ts">
// One team on the Coaches' Dashboard → Tasks: its tasks for the chosen sprint (relative to the team's own sprints),
// filtered, in the team's own order. Subtasks start collapsed. Registers itself with the page for selection, the
// bulk bar, and the totals line.
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { createTeamData } from '@/composables/useTeamData'
import { subtaskKey } from '@/composables/useSelection'
import type { Status, Team, WithId } from '@/model/types'
import { formatDotted, plural } from '@/ui/format'
import TeamBadge from '@/components/TeamBadge.vue'
import TaskRows from '@/components/tasks/TaskRows.vue'
import type { TaskField } from '@/components/tasks/TaskFieldCell.vue'
import { DASHBOARD_TASKS, type DashboardTasks } from './dashboardTasks'

const props = defineProps<{
  team: WithId<Team>
  sprint: 'previous' | 'current' | 'next' | 'all'
  statuses: readonly Status[]
  search: string
}>()

const page = inject(DASHBOARD_TASKS) as DashboardTasks
const data = createTeamData(() => props.team.id)
const COLUMNS: TaskField[] = ['status', 'due', 'assignee', 'subteam']

const shownSprint = computed(() => {
  const list = data.sprints.value
  const at = list.findIndex((s) => s.id === data.currentSprint.value?.id)
  if (props.sprint === 'all' || at < 0) return null
  return list[at + (props.sprint === 'previous' ? -1 : props.sprint === 'next' ? 1 : 0)] ?? null
})
const tasks = computed(() => {
  const query = props.search.trim().toLowerCase()
  const inScope =
    props.sprint === 'all'
      ? data.tasks.value
      : shownSprint.value
        ? data.tasksIn(shownSprint.value.id)
        : []
  return inScope.filter(
    (task) =>
      (!props.statuses.length || props.statuses.includes(task.status)) &&
      (!query ||
        [task.title, ...task.assigneeIds.map(data.nameOf)].join(' ').toLowerCase().includes(query)),
  )
})
const done = computed(() => tasks.value.filter((task) => task.status === 'Done').length)
const keys = () =>
  tasks.value.flatMap((task) => [
    task.id,
    ...task.subtasks.filter((s) => !s.archived).map((s) => subtaskKey(task.id, s.id)),
  ])

page.register(props.team.id, { data, keys, count: () => tasks.value.length })
onBeforeUnmount(() => page.unregister(props.team.id))

const open = ref(!page.collapsed.value.has(props.team.id))
watch(open, (isOpen) => page.setCollapsed(props.team.id, !isOpen))
const hidden = computed(() => !tasks.value.length && (props.search.trim() || props.statuses.length))
</script>

<template>
  <tbody v-if="!hidden" class="team-group">
    <tr class="group-row">
      <td :colspan="COLUMNS.length + 1">
        <div class="group-head">
          <button type="button" class="toggle" :aria-expanded="open" @click="open = !open">
            <span class="arrow" aria-hidden="true">▾</span>
            <TeamBadge :team="team" size="small" class="badge" />
            <strong>{{ team.name }}</strong>
          </button>
          <span class="sprint">
            <template v-if="shownSprint"
              >{{ shownSprint.name }} · {{ formatDotted(shownSprint.start) }} –
              {{ formatDotted(shownSprint.end) }}</template
            >
            <template v-else-if="sprint === 'all'">All tasks</template>
            <template v-else>No {{ sprint }} sprint</template>
          </span>
          <small>{{ plural(tasks.length, 'task') }} · {{ done }} done</small>
          <RouterLink
            class="open-team"
            :to="{ name: 'team', params: { teamId: team.id, tab: 'board' } }"
            >Open team →</RouterLink
          >
        </div>
      </td>
    </tr>
    <TaskRows
      v-if="open"
      :team="data"
      :tasks="tasks"
      :columns="COLUMNS"
      :reorder="false"
      :is-selected="(key: string) => page.has(team.id, key)"
      @select="(key: string, event: MouseEvent) => page.toggle(team.id, key, event)"
    />
    <tr v-if="open && !tasks.length && !data.loading.value" class="empty-row">
      <td :colspan="COLUMNS.length + 1">No tasks.</td>
    </tr>
  </tbody>
</template>

<style scoped>
.group-row td {
  padding: 22px 6px 6px !important;
  border-bottom: 1px solid var(--line);
}
.team-group:first-of-type .group-row td {
  padding-top: 8px !important;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #202124;
  font-size: 14px;
}
.arrow {
  color: #737d86;
  font-size: 10px;
  transition: transform 0.15s;
}
.toggle[aria-expanded='false'] .arrow {
  transform: rotate(-90deg);
}
.badge {
  width: 46px;
  height: 20px;
}
.sprint {
  color: #6b757e;
  font-size: 12px;
}
small {
  margin-left: auto;
  color: #8a949c;
  font-size: 12px;
}
.open-team {
  color: #59636d;
  font-size: 12px;
  font-weight: 650;
  text-decoration: none;
}
.open-team:hover {
  color: var(--team-ink);
}
.empty-row td {
  color: var(--muted);
}
</style>
