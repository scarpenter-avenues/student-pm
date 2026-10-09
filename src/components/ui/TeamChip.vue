<script setup lang="ts">
// A team's name in its own color (announcement audiences, huddle plans, people lists).
import { computed } from 'vue'
import { teamColorOf } from '@/ui/teamColor'

const props = defineProps<{ team: { name: string; color: string } }>()
const colors = computed(() => teamColorOf(props.team.color))
</script>

<template>
  <span class="team-chip" :style="{ background: colors.bg, color: colors.fg }">{{
    team.name
  }}</span>
</template>

<style scoped>
.team-chip {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}
</style>
