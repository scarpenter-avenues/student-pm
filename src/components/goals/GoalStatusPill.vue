<script setup lang="ts">
// A goal's status ("Making progress", "Stuck", ...) as a colored pill. The color comes from its place on the
// status scale (styles in goals.css).
import { GOAL_STATUSES } from '@/model/goals'
import type { GoalStatus } from '@/model/types'

defineProps<{ status: GoalStatus }>()
</script>

<template>
  <span :class="`goal-status s-${GOAL_STATUSES.indexOf(status) + 1}`">{{ status }}</span>
</template>
