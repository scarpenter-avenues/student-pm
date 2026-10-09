<script setup lang="ts">
// A task's subteams as colored tags, in the team's subteam order. "—" when there are none.
import { computed } from 'vue'
import type { Subteam } from '@/model/types'
import { SUBTEAM_PALETTE } from '@/ui/palette'

const props = defineProps<{
  /** The team's subteams (for names, colors, and order). */
  subteams: readonly Subteam[]
  ids: readonly string[]
}>()

const tags = computed(() => props.subteams.filter((subteam) => props.ids.includes(subteam.id)))
</script>

<template>
  <span class="subteam-tags">
    <span
      v-for="subteam in tags"
      :key="subteam.id"
      class="tag"
      :style="{
        background: SUBTEAM_PALETTE[subteam.color].bg,
        color: SUBTEAM_PALETTE[subteam.color].fg,
      }"
      >{{ subteam.name }}</span
    >
    <span v-if="!tags.length" class="none">—</span>
  </span>
</template>

<style scoped>
.subteam-tags {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 3px;
  vertical-align: middle;
}
.tag {
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}
.none {
  color: #9aa3aa;
}
</style>
