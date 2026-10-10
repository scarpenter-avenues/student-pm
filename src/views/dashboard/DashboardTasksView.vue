<script setup lang="ts">
// Coaches' Dashboard → Tasks: every team's tasks, grouped by team, for the previous / current / next sprint (each
// team's own) or all of them. Filters: team, status (several), search. Bulk: Status and Archive (teams have
// different rosters, so no Assign). Columns: Name · Status · Due date · Assignee · Subteam.
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import type { Status } from '@/model/types'
import { useSession } from '@/stores/session'
import { STATUSES } from '@/ui/options'
import { plural } from '@/ui/format'
import BulkBar from '@/components/tasks/BulkBar.vue'
import MultiFilter from '@/components/ui/MultiFilter.vue'
import SelectButton from '@/components/ui/SelectButton.vue'
import TeamTaskGroup from '@/components/dashboard/TeamTaskGroup.vue'
import {
  DASHBOARD_TASKS,
  createDashboardTasks,
  totalOf,
} from '@/components/dashboard/dashboardTasks'

const session = useSession()
type SprintScope = 'previous' | 'current' | 'next' | 'all'
const sprint = ref<SprintScope>('current')
const teamFilter = ref('all')
const statuses = ref<string[]>([])
const search = ref('')

const teams = computed(() =>
  session.teams.filter((team) => teamFilter.value === 'all' || team.id === teamFilter.value),
)
const page = createDashboardTasks(() => teams.value.map((team) => team.id))
provide(DASHBOARD_TASKS, page)
const total = totalOf(page)
const scopeText: Record<SprintScope, string> = {
  previous: "each team's previous sprint",
  current: "each team's current sprint",
  next: "each team's next sprint",
  all: 'all sprints and the Backlog',
}
const items = computed(() =>
  [...page.selected.value].flatMap((full) => {
    const [teamId = '', key = ''] = full.split('::')
    const group = page.groups.get(teamId)
    return group ? [{ key, team: group.data }] : []
  }),
)
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && page.selected.value.size && !event.defaultPrevented) page.clear()
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="dashboard-tasks">
    <div class="head">
      <div>
        <h2>Tasks</h2>
        <p>
          {{ plural(total, 'task') }} across {{ plural(teams.length, 'team') }} ·
          {{ scopeText[sprint] }}
        </p>
      </div>
      <div class="filters">
        <SelectButton
          v-model="sprint"
          class="filter"
          label="Sprint"
          :options="[
            { value: 'previous', label: 'Previous Sprint' },
            { value: 'current', label: 'Current Sprint' },
            { value: 'next', label: 'Next Sprint' },
            { value: 'all', label: 'All Tasks' },
          ]"
        >
          <template #value="{ value }">{{
            {
              previous: 'Previous Sprint',
              current: 'Current Sprint',
              next: 'Next Sprint',
              all: 'All Tasks',
            }[value as SprintScope]
          }}</template>
        </SelectButton>
        <SelectButton
          v-model="teamFilter"
          class="filter"
          label="Team"
          :options="[
            { value: 'all', label: 'All teams' },
            ...session.teams.map((t) => ({ value: t.id, label: t.name })),
          ]"
        >
          <template #value="{ value }">{{
            value === 'all' ? 'All teams' : session.teamsById[value as string]?.name
          }}</template>
        </SelectButton>
        <MultiFilter v-model="statuses" label="Status" all-label="Any status" :options="STATUSES" />
        <label class="search">
          <span aria-hidden="true">⌕</span>
          <input
            v-model="search"
            type="search"
            placeholder="Find a task or person"
            aria-label="Find a task or person"
          />
        </label>
      </div>
    </div>
    <div class="table-wrap">
      <table class="task-table dense">
        <colgroup>
          <col />
          <col style="width: 130px" />
          <col style="width: 110px" />
          <col style="width: 220px" />
          <col style="width: 170px" />
        </colgroup>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Due date</th>
            <th>Assignee</th>
            <th>Subteam</th>
          </tr>
        </thead>
        <TeamTaskGroup
          v-for="team in teams"
          :key="team.id"
          :team="team"
          :sprint="sprint"
          :statuses="statuses as Status[]"
          :search="search"
        />
      </table>
    </div>
    <BulkBar :items="items" @clear="page.clear()" />
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}
h2 {
  margin: 0;
  font-size: 20px;
}
.head p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.filter {
  min-width: 128px;
  min-height: 36px;
  border-color: var(--line);
}
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: #8a949c;
}
.search input {
  width: 140px;
  border: 0;
  outline: none;
  font-size: 13px;
}
.table-wrap {
  overflow-x: auto;
}
.table-wrap .task-table {
  min-width: 820px;
}
</style>
