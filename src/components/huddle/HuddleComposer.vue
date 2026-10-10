<script setup lang="ts">
// Post today's huddle (program coaches): session date, where things stand, a timed plan (time · what · who; "Copy
// plan from <last huddle>"), and optional heads-ups. Keep student health, family, and discipline details out.
import { reactive, ref } from 'vue'
import { todayIso } from '@/model/dates'
import type { HuddlePlanRow } from '@/model/types'
import { formatEventDate } from '@/ui/format'
import DateButton from '@/components/ui/DateButton.vue'
import RichEditor from '@/components/ui/RichEditor.vue'
import WhoPicker from './WhoPicker.vue'

const props = defineProps<{
  teams: readonly { id: string; name: string; color: string }[]
  lastPlan: { date: string; plan: HuddlePlanRow[] } | null
}>()
const emit = defineEmits<{
  post: [
    fields: {
      date: string
      statusHtml: string
      status: string
      plan: HuddlePlanRow[]
      notesHtml: string
      notes: string
    },
  ]
  cancel: []
}>()

const date = ref<string | null>(todayIso())
const status = reactive({ html: '', text: '' })
const notes = reactive({ html: '', text: '' })
const plan = ref<HuddlePlanRow[]>([{ time: '15:30', text: '', audience: ['all'] }])
const error = ref('')

function addRow() {
  const last = plan.value.at(-1)
  plan.value = [...plan.value, { time: last?.time ?? '15:30', text: '', audience: ['all'] }]
}
function removeRow(index: number) {
  plan.value = plan.value.filter((_, i) => i !== index)
}
function copyPlan() {
  if (props.lastPlan)
    plan.value = props.lastPlan.plan.map((row) => ({ ...row, audience: [...row.audience] }))
}
function post() {
  const rows = plan.value
    .filter((row) => row.text.trim())
    .map((row) => ({ ...row, text: row.text.trim() }))
  if (!date.value) return (error.value = 'Pick the session date.')
  if (!status.text.trim() && !rows.length)
    return (error.value = 'Add where things stand or a plan.')
  emit('post', {
    date: date.value,
    statusHtml: status.html,
    status: status.text.trim(),
    plan: rows.sort((a, b) => a.time.localeCompare(b.time)),
    notesHtml: notes.html,
    notes: notes.text.trim(),
  })
}
</script>

<template>
  <form class="composer" @submit.prevent="post" @keydown.esc.prevent="emit('cancel')">
    <div class="field-row">
      <span class="label">Session</span>
      <DateButton v-model="date" label="Session date" :clearable="false" />
    </div>
    <span class="label">Where things stand</span>
    <div class="rich">
      <RichEditor
        :model-value="status.html"
        placeholder="How teams are doing, what's coming up…"
        label="Where things stand"
        @change="Object.assign(status, $event)"
      />
    </div>
    <div class="plan-head">
      <span class="label">Plan for the session</span>
      <button v-if="lastPlan" type="button" class="text-link" @click="copyPlan">
        Copy plan from {{ formatEventDate(lastPlan.date) }}
      </button>
    </div>
    <div v-for="(row, index) in plan" :key="index" class="plan-row">
      <input v-model="row.time" type="time" aria-label="Time" />
      <input v-model="row.text" maxlength="120" placeholder="What" aria-label="What" />
      <WhoPicker v-model="row.audience" :teams="teams" />
      <button
        type="button"
        class="remove"
        :aria-label="`Remove row ${index + 1}`"
        @click="removeRow(index)"
      >
        ×
      </button>
    </div>
    <button type="button" class="text-link add" @click="addRow">+ Add a row</button>
    <span class="label">Heads-ups and needs <small>(optional)</small></span>
    <div class="rich">
      <RichEditor
        :model-value="notes.html"
        placeholder="Room changes, equipment, anything you need help with…"
        label="Heads-ups and needs"
        @change="Object.assign(notes, $event)"
      />
    </div>
    <p class="hint">Keep student health, family, and discipline details out of huddles.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="actions">
      <button type="button" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="save">Post huddle</button>
    </div>
  </form>
</template>

<style scoped>
.composer {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
  padding: 14px 16px;
  border: 1px solid var(--team-line);
  border-radius: 9px;
}
.label {
  color: #59636d;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
.label small {
  font-weight: 500;
  text-transform: none;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rich {
  padding: 2px 10px;
  border: 1px solid #d5dce5;
  border-radius: 6px;
}
.rich :deep(.rich-content) {
  min-height: 56px;
  font-size: 14px;
}
.plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.plan-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 170px 28px;
  align-items: center;
  gap: 6px;
}
.plan-row input {
  height: 32px;
  padding: 0 8px;
  border: 1px solid #d5dce5;
  border-radius: 6px;
  font-size: 13px;
}
.remove {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #8a949c;
  font-size: 16px;
}
.remove:hover {
  background: #f3f5f8;
  color: #a43d34;
}
.text-link {
  justify-self: start;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2864c7;
  font-size: 13px;
}
.hint {
  margin: 0;
  color: #737d86;
  font-size: 12px;
}
.error {
  margin: 0;
  color: var(--red);
  font-size: 13px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.actions button {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
}
.actions .save {
  border-color: #356fd1;
  background: #356fd1;
  color: #fff;
  font-weight: 650;
}
@media (max-width: 680px) {
  .plan-row {
    grid-template-columns: 96px minmax(0, 1fr) 28px;
  }
  .plan-row :deep(.who) {
    grid-column: 1 / -1;
  }
}
</style>
