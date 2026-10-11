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
// The "Run by" choices: no one, or any coach or mentor.
const adultOptions = () => [
  { value: '', label: 'No one' },
  ...props.adults.map((adult) => ({ value: adult.id, label: adult.displayName })),
]
// Sets who runs a row; "No one" removes the field.
function setRunBy(row: HuddlePlanRow, id: string) {
  if (id) row.runBy = id
  else delete row.runBy
}

// Adds a row for all teams, starting at the last row's time.
function addRow() {
  rows.value = [
    ...rows.value,
    { time: rows.value.at(-1)?.time ?? '15:30', text: '', audience: ['all'] },
  ]
}
// Removes a row.
function removeRow(index: number) {
  rows.value = rows.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div v-for="(row, index) in rows" :key="index" class="plan-row">
    <input v-model="row.time" type="time" aria-label="Time" />
    <input v-model="row.text" maxlength="120" placeholder="What" aria-label="What" />
    <div class="people">
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
    </div>
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
/* On wide screens the two pickers are just two more columns of the row. */
.plan-row .people {
  display: contents;
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
/* Phones: two lines per row. Time, what, and × on the first; who runs it and who it's for share the second. */
@media (max-width: 680px) {
  .plan-row {
    grid-template-columns: 104px minmax(0, 1fr) 28px;
    grid-template-areas:
      'time what remove'
      'people people people';
    padding-bottom: 6px;
    border-bottom: 1px solid #edf0f2;
  }
  .plan-row > input[type='time'] {
    grid-area: time;
    min-width: 0;
  }
  .plan-row > input:not([type='time']) {
    grid-area: what;
    min-width: 0;
  }
  .plan-row .remove {
    grid-area: remove;
  }
  .plan-row .people > :deep(*) {
    width: 100%;
    min-width: 0;
  }
  .plan-row .people {
    display: grid;
    grid-area: people;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
}
</style>
