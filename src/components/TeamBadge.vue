<script setup lang="ts">
// A team's colored number block. With no team, the dark "All" badge of the Coaches' Dashboard.
import { computed } from 'vue'
import { teamColorOf } from '@/ui/teamColor'

const props = defineProps<{
  team?: { number: string; color: string } | null
  size?: 'large' | 'small'
}>()

const style = computed(() => {
  if (!props.team) return { background: '#2c343b', color: '#fff' }
  const colors = teamColorOf(props.team.color)
  return { background: colors.bg, color: colors.fg }
})
</script>

<template>
  <span class="team-badge" :class="size ?? 'large'" :style="style" aria-hidden="true">{{
    team ? team.number || '—' : 'All'
  }}</span>
</template>

<style scoped>
.team-badge {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  font-weight: 800;
}
.large {
  min-width: 28px;
  height: 28px;
  padding: 0 5px;
  border-radius: 7px;
  font-size: 13px;
}
.small {
  min-width: 26px;
  height: 22px;
  padding: 0 4px;
  border-radius: 6px;
  font-size: 10px;
}
</style>
