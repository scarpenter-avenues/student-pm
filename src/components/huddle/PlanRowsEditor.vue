<script setup lang="ts">
// A huddle plan's rows: time · what · run by (optional coach or mentor) · who · ×, then "+ Add a row". Used by the huddle composer and by Program
// settings → Default huddle plan.
import type { HuddlePlanRow } from '@/model/types'
import SelectButton from '@/components/ui/SelectButton.vue'
import WhoPicker from './WhoPicker.vue'

const rows = defineModel<HuddlePlanRow[]>({ required: true })
const props = defineProps<{
  teams: readonly { id: string; name: string; color: string }[]
  /** Coaches and mentors who can run a row. */
  adults: readonly { id: string; displayName: string }[]
}>()
const adultOptions = () => [
  { value: '', label: 'No one' },
  ...props.adults.map((adult) => ({ value: adult.id, label: adult.displayName })),
]
function setRunBy(row: HuddlePlanRow, id: string) {
  if (id) row.runBy = id
  else delete row.runBy
}

function addRow() {
  rows.value = [
    ...rows.value,
    { time: rows.value.at(-1)?.time ?? '15:30', text: '', audience: ['all'] },
  ]
}
function removeRow(index: number) {
  rows.value = rows.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div v-for="(row, index) in rows" :key="index" class="plan-row">
    <input v-model="row.time" type="time" aria-label="Time" />
    <input v-model="row.text" maxlength="120" placeholder="What" aria-label="What" />
    <SelectButton
      class="run-by"
      :model-value="row.runBy ?? ''"
      :options="adultOptions()"
      label="Run by"
      placeholder="Run by"
      @update:model-value="setRunBy(row, $event as string)"
    >
      <template #value="{ value }">{{
        adults.find((adult) => adult.id === value)?.displayName ?? 'Run by'
      }}</template>
    </SelectButton>
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
  <button type="button" class="add" @click="addRow">+ Add a row</button>
</template>

<style scoped>
.plan-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 140px 170px 28px;
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
.add {
  justify-self: start;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2864c7;
  font-size: 13px;
}
@media (max-width: 680px) {
  .plan-row {
    grid-template-columns: 96px minmax(0, 1fr) 28px;
  }
  .plan-row :deep(.who),
  .plan-row .run-by {
    grid-column: span 2;
  }
}
</style>
