<script setup lang="ts">
// The one team picker (ported from teamChecklist). Students and leads (single): radios with "No team" on top; the
// menu closes on pick. Mentors (several): checkboxes with "All teams" on top (or "All my teams" when the choice is
// limited to a mentor's own teams). Changes apply when the menu closes, so ticking three teams is one update.
import { computed, onBeforeUnmount, ref } from 'vue'
import { teamColorOf } from '@/ui/teamColor'
import { useClickAway } from '@/composables/usePopover'
import FloatingPanel from './FloatingPanel.vue'

export interface TeamOption {
  id: string
  name: string
  color: string
}

// Attributes (class, data-*) go on the button; the popover is a second root.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue: readonly string[]
    teams: readonly TeamOption[]
    label: string
    single?: boolean
    /** The options are only some of the program's teams (a mentor's own): "All my teams". */
    limited?: boolean
  }>(),
  { single: false, limited: false },
)
const emit = defineEmits<{ 'update:modelValue': [ids: string[]] }>()

const button = ref<HTMLButtonElement | null>(null)
const panel = ref<InstanceType<typeof FloatingPanel> | null>(null)
const open = ref(false)
const chosen = ref<string[]>([])
const group = `team-picker-${Math.random().toString(36).slice(2, 8)}`

const allLabel = computed(() => (props.limited ? 'All my teams' : 'All teams'))
function summary(ids: readonly string[]) {
  const names = props.teams.filter((team) => ids.includes(team.id)).map((team) => team.name)
  if (!names.length) return 'No team'
  if (names.length === 1) return names[0]!
  return !props.single && names.length === props.teams.length
    ? allLabel.value
    : `${names.length} teams`
}
const every = computed(() => chosen.value.length === props.teams.length)

function toggleOpen() {
  if (open.value) return close()
  chosen.value = [...props.modelValue]
  open.value = true
}
function close() {
  if (!open.value) return
  open.value = false
  const before = [...props.modelValue].sort().join()
  if (before !== [...chosen.value].sort().join())
    emit(
      'update:modelValue',
      props.teams.map((team) => team.id).filter((id) => chosen.value.includes(id)),
    )
}
function pickOne(id: string | null) {
  chosen.value = id ? [id] : []
  close()
  button.value?.focus()
}
function toggle(id: string, on: boolean) {
  chosen.value = on ? [...chosen.value, id] : chosen.value.filter((other) => other !== id)
}
function toggleAll(on: boolean) {
  chosen.value = on ? props.teams.map((team) => team.id) : []
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    open.value = false // Esc cancels
    button.value?.focus()
  }
}

useClickAway(() => [button.value, panel.value?.element], close)
onBeforeUnmount(close)
</script>

<template>
  <button
    v-bind="$attrs"
    ref="button"
    type="button"
    class="check-button"
    :aria-label="label"
    aria-haspopup="true"
    :aria-expanded="open"
    :title="
      teams
        .filter((team) => modelValue.includes(team.id))
        .map((team) => team.name)
        .join(', ')
    "
    @click="toggleOpen"
    @keydown="onKeydown"
  >
    {{ summary(modelValue) }}
  </button>
  <FloatingPanel
    v-if="open"
    ref="panel"
    :anchor="button"
    class="check-menu"
    autofocus="input:checked, input"
    @keydown="onKeydown"
  >
    <template v-if="single">
      <label>
        <input type="radio" :name="group" :checked="!chosen.length" @change="pickOne(null)" />
        No team
      </label>
      <hr />
      <label v-for="team in teams" :key="team.id">
        <input
          type="radio"
          :name="group"
          :checked="chosen.includes(team.id)"
          @change="pickOne(team.id)"
        />
        <span class="team-dot" :style="{ background: teamColorOf(team.color).bg }" />
        {{ team.name }}
      </label>
    </template>
    <template v-else>
      <template v-if="teams.length > 1">
        <label>
          <input
            type="checkbox"
            :checked="every"
            :indeterminate="chosen.length > 0 && !every"
            @change="toggleAll(($event.target as HTMLInputElement).checked)"
          />
          {{ allLabel }}
        </label>
        <hr />
      </template>
      <label v-for="team in teams" :key="team.id">
        <input
          type="checkbox"
          :checked="chosen.includes(team.id)"
          @change="toggle(team.id, ($event.target as HTMLInputElement).checked)"
        />
        <span class="team-dot" :style="{ background: teamColorOf(team.color).bg }" />
        {{ team.name }}
      </label>
    </template>
  </FloatingPanel>
</template>
