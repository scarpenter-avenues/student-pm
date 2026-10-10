<script setup lang="ts">
// The sprint title and dates, the sprint picker (it changes the heading, the objectives, and the tasks), and the
// sprint's objectives. My Tasks always shows the current sprint and has no picker.
import { computed } from 'vue'
import type { Sprint, WithId } from '@/model/types'
import { todayIso } from '@/model/dates'
import { formatDotted, plural } from '@/ui/format'
import { useTeam } from '@/composables/useTeamData'
import { useTaskFilters } from '@/stores/taskFilters'
import SelectButton from '@/components/ui/SelectButton.vue'
import ObjectivesPanel from './ObjectivesPanel.vue'

const props = defineProps<{ sprint: WithId<Sprint> | 'all' | null; picker?: boolean }>()

const team = useTeam()
const filters = useTaskFilters()

function phase(sprint: WithId<Sprint>) {
  const today = todayIso()
  if (sprint.id === team.currentSprint.value?.id) return 'Current'
  return sprint.end < today ? 'Past' : 'Upcoming'
}
const title = computed(() =>
  props.sprint === 'all' ? 'All sprints' : (props.sprint?.name ?? 'No sprints yet'),
)
const dates = computed(() => {
  const list = team.sprints.value
  if (props.sprint === 'all') {
    const first = list[0]
    const last = list.at(-1)
    return first && last
      ? `${formatDotted(first.start)} – ${formatDotted(last.end)} · ${plural(list.length, 'sprint')}`
      : ''
  }
  return props.sprint
    ? `${formatDotted(props.sprint.start)} – ${formatDotted(props.sprint.end)} · ${phase(props.sprint)}`
    : ''
})
const options = computed(() => [
  { value: 'all', label: 'All sprints' },
  ...team.sprints.value.map((sprint) => ({
    value: sprint.id === team.currentSprint.value?.id ? 'current' : sprint.id,
    label: sprint.id === team.currentSprint.value?.id ? `${sprint.name} · Current` : sprint.name,
  })),
])
const shownSprints = computed(() =>
  props.sprint === 'all' ? team.sprints.value : props.sprint ? [props.sprint] : [],
)
</script>

<template>
  <div class="workspace-heading">
    <div>
      <h2>{{ title }}</h2>
      <p>{{ dates }}</p>
    </div>
    <SelectButton
      v-if="picker && team.sprints.value.length"
      v-model="filters.sprint"
      class="sprint-picker"
      label="Sprint"
      :options="options"
    >
      <template #value="{ value }">{{
        options.find((option) => option.value === value)?.label
      }}</template>
    </SelectButton>
  </div>
  <ObjectivesPanel
    v-if="team.teamId.value && shownSprints.length"
    :team-id="team.teamId.value"
    :sprints="shownSprints"
    :subteams="team.subteams.value"
    :can-mark="team.can.value.plan"
  />
</template>

<style scoped>
.workspace-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 0 0 10px;
}
h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}
p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.sprint-picker {
  min-height: 36px;
  border-color: var(--line);
}
</style>
