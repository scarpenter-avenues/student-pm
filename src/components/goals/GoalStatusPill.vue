<script setup lang="ts">
import { GOAL_STATUSES } from '@/model/goals'
import type { GoalStatus } from '@/model/types'

defineProps<{ status: GoalStatus }>()
</script>

<template>
  <span :class="`goal-status s-${GOAL_STATUSES.indexOf(status) + 1}`">{{ status }}</span>
</template>
