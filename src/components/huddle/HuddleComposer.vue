<script setup lang="ts">
// A new huddle, or changes to a posted one (program coaches): date, where things stand, a timed plan (time · what · who; "Import default" from
// Program settings, or "Copy plan from <last huddle>"), and optional heads-ups. Keep student health, family, and
// discipline details out.
import { reactive, ref } from 'vue'
import { todayIso } from '@/model/dates'
import { cleanPlan } from '@/model/huddles'
import type { Huddle, HuddlePlanRow } from '@/model/types'
import { formatEventDate } from '@/ui/format'
import type { MentionSearch } from '@/ui/mentions'
import DateButton from '@/components/ui/DateButton.vue'
import RichEditor from '@/components/ui/RichEditor.vue'
import PlanRowsEditor from './PlanRowsEditor.vue'

const props = defineProps<{
  teams: readonly { id: string; name: string; color: string }[]
  lastPlan: { date: string; plan: HuddlePlanRow[] } | null
  adults: readonly { id: string; displayName: string }[]
  /** @ mentions in the two text boxes. */
  mentions: MentionSearch
  /** The program's default plan (fresh rows each time). */
  defaultPlan: () => HuddlePlanRow[]
  /** A posted huddle to edit (the panel starts filled in and saves changes instead of posting). */
  huddle?: Huddle | null
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

const start = props.huddle
const date = ref<string | null>(start?.date ?? todayIso())
const status = reactive({ html: start?.statusHtml ?? '', text: start?.status ?? '' })
const notes = reactive({ html: start?.notesHtml ?? '', text: start?.notes ?? '' })
const plan = ref<HuddlePlanRow[]>(
  start?.plan?.length
    ? start.plan.map((row) => ({ ...row, audience: [...row.audience] }))
    : [{ time: '15:30', text: '', audience: ['all'] }],
)
const error = ref('')

function copyPlan() {
  if (props.lastPlan)
    plan.value = props.lastPlan.plan.map((row) => ({ ...row, audience: [...row.audience] }))
}
function post() {
  const rows = cleanPlan(plan.value)
  if (!date.value) return (error.value = 'Pick the date.')
  if (!status.text.trim() && !rows.length)
    return (error.value = 'Add where things stand or a plan.')
  emit('post', {
    date: date.value,
    statusHtml: status.html,
    status: status.text.trim(),
    plan: rows,
    notesHtml: notes.html,
    notes: notes.text.trim(),
  })
}
</script>

<template>
  <form class="composer" @submit.prevent="post" @keydown.esc.prevent="emit('cancel')">
    <div class="field-row">
      <span class="label">Date</span>
      <DateButton v-model="date" label="Date" :clearable="false" />
    </div>
    <span class="label">Where things stand</span>
    <div class="rich">
      <RichEditor
        :model-value="status.html"
        placeholder="How things are going, what's coming up…"
        label="Where things stand"
        :mentions="mentions"
        @change="Object.assign(status, $event)"
      />
    </div>
    <div class="plan-head">
      <span class="label">Plan for the session</span>
      <div class="plan-sources">
        <button type="button" class="small-button" @click="plan = defaultPlan()">
          Import default
        </button>
        <button v-if="lastPlan" type="button" class="small-button" @click="copyPlan">
          Copy plan from {{ formatEventDate(lastPlan.date) }}
        </button>
      </div>
    </div>
    <PlanRowsEditor v-model="plan" :teams="teams" :adults="adults" />
    <span class="label">Heads-ups and needs <small>(optional)</small></span>
    <div class="rich">
      <RichEditor
        :model-value="notes.html"
        placeholder="Room changes, equipment, anything you need help with…"
        label="Heads-ups and needs"
        :mentions="mentions"
        @change="Object.assign(notes, $event)"
      />
    </div>
    <p class="hint">Keep student health, family, and discipline details out of huddles.</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="actions">
      <button type="button" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="save">{{ huddle ? 'Save changes' : 'Post huddle' }}</button>
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.plan-sources {
  display: flex;
  gap: 6px;
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
</style>
