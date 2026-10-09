<script setup lang="ts">
import type { Status } from '@/model/types'

defineProps<{ status: Status }>()
</script>

<template>
  <span
    class="status-chip"
    :class="{ 'in-progress': status === 'In progress', done: status === 'Done' }"
    >{{ status }}</span
  >
</template>

<style scoped>
.status-chip {
  display: inline-block;
  padding: 3px 7px;
  border-radius: 5px;
  background: #f0f2f1;
  color: #5f6969;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}
.in-progress {
  background: #fff0dc;
  color: #a45c0a;
}
.done {
  background: #e6f5eb;
  color: #267b49;
}
</style>
