<script setup lang="ts">
// Who a plan row is for: All teams (exclusive), Coaches & mentors, or any teams. Stored as an audience array
// (["all"], ["adults"], team ids). Shown as one chip each; All teams shows no chip (it's the default).
import { computed, ref } from 'vue'
import { useClickAway } from '@/composables/usePopover'
import { teamColorOf } from '@/ui/teamColor'
import FloatingPanel from '@/components/ui/FloatingPanel.vue'

const props = defineProps<{
  modelValue: readonly string[]
  teams: readonly { id: string; name: string; color: string }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const button = ref<HTMLButtonElement | null>(null)
const panel = ref<InstanceType<typeof FloatingPanel> | null>(null)
const open = ref(false)
useClickAway(
  () => [button.value, panel.value?.element],
  () => (open.value = false),
)

function toggle(value: string, on: boolean) {
  if (value === 'all') return emit('update:modelValue', ['all'])
  const next = on
    ? [...props.modelValue.filter((item) => item !== 'all'), value]
    : props.modelValue.filter((item) => item !== value)
  emit('update:modelValue', next.length ? next : ['all'])
}
const summary = computed(() => {
  const value = props.modelValue
  if (!value.length || value.includes('all')) return 'All teams'
  const teams = value.filter((id) => id !== 'adults').length
  if (value.includes('adults'))
    return teams ? `Coaches + ${teams} ${teams === 1 ? 'team' : 'teams'}` : 'Coaches & mentors'
  return teams === 1
    ? (props.teams.find((t) => t.id === value[0])?.name ?? '1 team')
    : `${teams} teams`
})
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
    button.value?.focus()
  }
}
</script>

<template>
  <button
    ref="button"
    type="button"
    class="check-button who"
    aria-label="Who"
    :aria-expanded="open"
    @click="open = !open"
    @keydown="onKeydown"
  >
    {{ summary }}
  </button>
  <FloatingPanel
    v-if="open"
    ref="panel"
    :anchor="button"
    class="check-menu"
    autofocus="input:checked, input"
    @keydown="onKeydown"
  >
    <label>
      <input type="checkbox" :checked="modelValue.includes('all')" @change="toggle('all', true)" />
      All teams
    </label>
    <label>
      <input
        type="checkbox"
        :checked="modelValue.includes('adults')"
        @change="toggle('adults', ($event.target as HTMLInputElement).checked)"
      />
      Coaches &amp; mentors
    </label>
    <hr />
    <label v-for="team in teams" :key="team.id">
      <input
        type="checkbox"
        :checked="modelValue.includes(team.id)"
        @change="toggle(team.id, ($event.target as HTMLInputElement).checked)"
      />
      <span class="team-dot" :style="{ background: teamColorOf(team.color).bg }" />
      {{ team.name }}
    </label>
  </FloatingPanel>
</template>

<style scoped>
.who {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
