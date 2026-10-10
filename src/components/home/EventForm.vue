<script setup lang="ts">
// Add or edit an event: name, date (picked), type, time, who it's for (program coaches may pick All teams when
// adding), and location. Esc cancels.
import { nextTick, onMounted, reactive, ref } from 'vue'
import type { CalendarEvent, EventType } from '@/model/types'
import type { TeamEvent } from '@/composables/useEvents'
import { EVENT_ICONS } from '@/composables/useEvents'
import DateButton from '@/components/ui/DateButton.vue'
import SelectButton from '@/components/ui/SelectButton.vue'

const props = defineProps<{ event: TeamEvent | null; teamName: string; canPostProgram: boolean }>()
const emit = defineEmits<{
  save: [fields: CalendarEvent, scope: 'team' | 'program']
  remove: []
  cancel: []
}>()

const fields = reactive({
  title: props.event?.title ?? '',
  date: props.event?.date ?? (null as string | null),
  type: (props.event?.type ?? 'Competition') as EventType,
  time: props.event?.time ?? '',
  location: props.event?.location ?? '',
  conditional: props.event?.conditional ?? false,
  scope: (props.event?.scope ?? 'team') as 'team' | 'program',
})
const titleInput = ref<HTMLInputElement | null>(null)
onMounted(async () => {
  await nextTick()
  titleInput.value?.focus()
})
const typeOptions = (Object.keys(EVENT_ICONS) as EventType[]).map((type) => ({
  value: type,
  label: `${EVENT_ICONS[type]} ${type}`,
}))

function submit() {
  const title = fields.title.trim()
  if (!title) return titleInput.value?.focus()
  if (!fields.date) return
  emit(
    'save',
    {
      title,
      date: fields.date,
      type: fields.type,
      time: fields.time.trim(),
      location: fields.location.trim(),
      conditional: fields.type === 'Competition' && fields.conditional,
    },
    fields.scope,
  )
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    emit('cancel')
  }
}
</script>

<template>
  <form class="event-form" @submit.prevent="submit" @keydown="onKeydown">
    <input
      ref="titleInput"
      v-model="fields.title"
      maxlength="60"
      placeholder="Event name"
      aria-label="Event name"
      required
    />
    <div class="row">
      <DateButton
        v-model="fields.date"
        class="field"
        label="Event date"
        placeholder="Date"
        :clearable="false"
      />
      <SelectButton v-model="fields.type" class="field" label="Event type" :options="typeOptions">
        <template #value="{ value }">{{
          typeOptions.find((o) => o.value === value)?.label
        }}</template>
      </SelectButton>
    </div>
    <div class="row">
      <input
        v-model="fields.time"
        maxlength="30"
        placeholder="Time (9am–3pm)"
        aria-label="Event time"
      />
      <SelectButton
        v-model="fields.scope"
        class="field"
        label="Who it's for"
        :disabled="!canPostProgram || !!event"
        :options="[
          { value: 'team', label: teamName },
          { value: 'program', label: 'All teams' },
        ]"
      >
        <template #value="{ value }">{{ value === 'program' ? 'All teams' : teamName }}</template>
      </SelectButton>
    </div>
    <input
      v-model="fields.location"
      maxlength="120"
      placeholder="Location (optional)"
      aria-label="Event location"
    />
    <label v-if="fields.type === 'Competition'" class="check">
      <input v-model="fields.conditional" type="checkbox" /> If qualified (not counted down)
    </label>
    <div class="actions">
      <button type="button" @click="emit('cancel')">Cancel</button>
      <button v-if="event" type="button" class="delete" @click="emit('remove')">Delete</button>
      <button type="submit" class="save" :disabled="!fields.date">
        {{ event ? 'Save' : 'Add event' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.event-form {
  display: grid;
  gap: 7px;
  margin: 4px 0 10px;
  padding: 10px;
  border: 1px solid var(--team-line);
  border-radius: 8px;
  background: #fff;
}
input:not([type='checkbox']) {
  min-width: 0;
  height: 34px;
  padding: 0 9px;
  border: 1px solid #d5dce5;
  border-radius: 6px;
  font-size: 13px;
}
input:focus {
  border-color: var(--team-line);
  outline: 2px solid var(--team-soft);
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}
.field {
  width: 100%;
  min-height: 34px;
  overflow: hidden;
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #59636d;
  font-size: 12px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.actions button {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: #fff;
  font-size: 12px;
}
.actions .delete:hover {
  border-color: #e2b8b2;
  color: #a43d34;
}
.actions .save {
  border-color: #356fd1;
  background: #356fd1;
  color: #fff;
}
.actions .save:disabled {
  opacity: 0.6;
}
</style>
