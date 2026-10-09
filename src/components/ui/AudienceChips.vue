<script setup lang="ts">
// Who a post is for: the dark "All teams" pill when program-wide, otherwise one team-color chip per team.
import { computed } from 'vue'
import TeamChip from './TeamChip.vue'

const props = defineProps<{
  audience: readonly string[]
  teams: Readonly<Record<string, { name: string; color: string }>>
}>()

const everyone = computed(() => props.audience.includes('all'))
const chips = computed(() =>
  props.audience.flatMap((id) => {
    const team = props.teams[id]
    return team ? [{ id, team }] : []
  }),
)
</script>

<template>
  <span class="audience">
    <span v-if="everyone" class="all-teams">All teams</span>
    <template v-else>
      <TeamChip v-for="chip in chips" :key="chip.id" :team="chip.team" />
    </template>
  </span>
</template>

<style scoped>
.audience {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  vertical-align: 2px;
}
.all-teams {
  padding: 1px 7px;
  border-radius: 10px;
  background: #2c343b;
  color: #fff;
  font-size: 11px;
  font-weight: 650;
}
</style>
