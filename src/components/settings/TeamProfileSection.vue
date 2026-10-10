<script setup lang="ts">
// The team's name, FTC number, and color (program coaches and the team's mentors).
import { computed, ref, watch } from 'vue'
import { writes } from '@/data'
import type { Team, WithId } from '@/model/types'
import { useToast } from '@/stores/toast'
import TeamBadge from '@/components/TeamBadge.vue'
import TeamColorPicker from '@/components/ui/TeamColorPicker.vue'

const props = defineProps<{ team: WithId<Team>; editable: boolean }>()
const toast = useToast()
const name = ref(props.team.name)
const number = ref(props.team.number)
const color = ref(props.team.color)
watch(
  () => props.team,
  (team) => {
    name.value = team.name
    number.value = team.number
    color.value = team.color
  },
)
const changed = computed(
  () =>
    name.value.replace(/\s+/g, ' ').trim() !== props.team.name ||
    number.value.trim() !== props.team.number ||
    color.value !== props.team.color,
)
function save() {
  const clean = name.value.replace(/\s+/g, ' ').trim()
  if (!clean) return toast.show('The team needs a name.')
  writes
    .updateTeam(props.team.id, { name: clean, number: number.value.trim(), color: color.value })
    .then(() => toast.show('Team updated'))
    .catch((error: Error) => toast.show(`Couldn't save: ${error.message}`))
}
</script>

<template>
  <section class="settings-section">
    <header>
      <div>
        <h3>Team</h3>
        <p>The colored number block and name appear at the top of every page.</p>
      </div>
    </header>
    <div class="profile">
      <label class="settings-field"
        >Team name <input v-model="name" maxlength="40" :disabled="!editable"
      /></label>
      <label class="settings-field number"
        >FTC team number
        <input v-model="number" maxlength="6" inputmode="numeric" :disabled="!editable"
      /></label>
    </div>
    <div class="look">
      <TeamBadge :team="{ number: number || '—', color }" class="preview" />
      <TeamColorPicker v-model="color" :disabled="!editable" />
    </div>
    <button
      v-if="editable"
      type="button"
      class="small-button primary"
      :disabled="!changed"
      @click="save"
    >
      Save
    </button>
  </section>
</template>

<style scoped>
.profile {
  display: grid;
  grid-template-columns: minmax(0, 260px) 120px;
  gap: 10px;
  margin-bottom: 14px;
}
.look {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}
.preview {
  min-width: 54px;
  height: 48px;
  border-radius: 10px;
  font-size: 18px;
}
</style>
