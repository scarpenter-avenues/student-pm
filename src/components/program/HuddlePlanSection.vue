<script setup lang="ts">
// Default huddle plan: the rows "Import default" puts in a new huddle. Same rows as the composer (time · what · who);
// Save stores them on the program, Reset goes back to the built-in plan.
import { computed, ref, watch } from 'vue'
import { writes } from '@/data'
import { cleanPlan, defaultHuddlePlan } from '@/model/huddles'
import type { HuddlePlanRow, Program } from '@/model/types'
import { useToast } from '@/stores/toast'
import PlanRowsEditor from '@/components/huddle/PlanRowsEditor.vue'

const props = defineProps<{
  program: Program | null
  teams: readonly { id: string; name: string; color: string }[]
  adults: readonly { id: string; displayName: string }[]
}>()
const toast = useToast()

const saved = computed(() => defaultHuddlePlan(props.program))
// The editor's own copy, so edits don't touch `saved`.
const fresh = () => defaultHuddlePlan(props.program)
const rows = ref<HuddlePlanRow[]>(fresh())
const changed = computed(
  () => JSON.stringify(cleanPlan(rows.value)) !== JSON.stringify(cleanPlan(saved.value)),
)
// Someone else's save shows up here unless you're in the middle of editing.
watch(saved, () => {
  if (!changed.value) rows.value = fresh()
})

function run(write: Promise<void>, done: string) {
  write.then(
    () => toast.show(done),
    (e: Error) => toast.show(`Couldn't save: ${e.message}`),
  )
}
function save() {
  const plan = cleanPlan(rows.value)
  rows.value = plan.map((row) => ({ ...row, audience: [...row.audience] }))
  run(writes.setHuddlePlan(plan), 'Default huddle plan saved')
}
function reset() {
  run(writes.setHuddlePlan(null), 'Default huddle plan reset')
  rows.value = defaultHuddlePlan(null)
}
</script>

<template>
  <section class="settings-section">
    <header>
      <div>
        <h3>Default huddle plan</h3>
        <p>"Import default" in a new huddle starts from this plan.</p>
      </div>
      <button v-if="program?.huddlePlan" type="button" class="link-button" @click="reset">
        Reset
      </button>
    </header>
    <div class="rows">
      <PlanRowsEditor v-model="rows" :teams="teams" :adults="adults" />
    </div>
    <div v-if="changed" class="form-actions">
      <button type="button" class="small-button" @click="rows = fresh()">Cancel</button>
      <button type="button" class="small-button primary" @click="save">Save</button>
    </div>
  </section>
</template>

<style scoped>
.rows {
  display: grid;
  gap: 8px;
  max-width: 760px;
}
.form-actions {
  max-width: 760px;
  margin-top: 10px;
}
</style>
