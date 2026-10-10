<script setup lang="ts">
// The "N tasks · …" line just above the tasks, with the filters that apply only to tasks: subteam, assignee, search.
// My Tasks shows just the count.
import { computed } from 'vue'
import { useTeam } from '@/composables/useTeamData'
import { useTaskFilters } from '@/stores/taskFilters'
import { plural } from '@/ui/format'
import AvatarStack from '@/components/ui/AvatarStack.vue'
import SelectButton from '@/components/ui/SelectButton.vue'
import SubteamTags from '@/components/ui/SubteamTags.vue'

const props = withDefaults(defineProps<{ count: number; scope: string; showFilters?: boolean }>(), {
  showFilters: true,
})

const team = useTeam()
const filters = useTaskFilters()
const subteamOptions = computed(() => [
  { value: 'all', label: 'All subteams' },
  ...team.subteams.value.map((subteam) => ({ value: subteam.id, label: subteam.name })),
])
const assigneeOptions = computed(() => [
  { value: 'all', label: 'Anyone' },
  ...team.people.value.map((person) => ({ value: person.id, label: person.displayName })),
])
const roster = computed(() => team.people.value.map((person) => person.displayName))
const filtersShown = computed(() => props.showFilters)
</script>

<template>
  <div class="board-meta">
    <span
      ><strong>{{ plural(count, 'task') }}</strong> · {{ scope }}</span
    >
    <div v-if="filtersShown" class="task-filters">
      <SelectButton
        v-model="filters.subteam"
        class="filter"
        label="Subteam"
        :options="subteamOptions"
      >
        <template #value="{ value }">{{
          subteamOptions.find((o) => o.value === value)?.label
        }}</template>
        <template #option="{ option }">
          <span v-if="option.value === 'all'">All subteams</span>
          <SubteamTags v-else :subteams="team.subteams.value" :ids="[option.value as string]" />
        </template>
      </SelectButton>
      <SelectButton
        v-model="filters.assignee"
        class="filter"
        label="Assignee"
        :options="assigneeOptions"
      >
        <template #value="{ value }">{{
          assigneeOptions.find((o) => o.value === value)?.label
        }}</template>
      </SelectButton>
      <label class="search">
        <span aria-hidden="true">⌕</span>
        <input
          v-model="filters.search"
          type="search"
          placeholder="Find a task"
          aria-label="Find a task"
        />
      </label>
      <AvatarStack class="roster" :names="roster" :max="6" />
    </div>
  </div>
</template>

<style scoped>
.board-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin: 17px 0 11px;
  color: var(--muted);
  font-size: 13px;
}
strong {
  color: #566269;
  font-weight: 650;
}
.task-filters {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
}
.filter {
  min-width: 120px;
  min-height: 34px;
  border-color: var(--line);
  color: #536067;
}
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: #8a949c;
}
.search:focus-within {
  border-color: var(--team-line);
}
.search input {
  width: 130px;
  border: 0;
  outline: none;
  font-size: 13px;
}
.roster {
  margin-left: 6px;
}
@media (max-width: 680px) {
  .task-filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    width: 100%;
    margin-left: 0;
  }
  .filter {
    width: 100%;
    min-width: 0;
  }
  .search {
    grid-column: 1 / -1;
  }
  .search input {
    width: 100%;
  }
  .roster {
    display: none;
  }
}
</style>
