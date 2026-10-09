<script setup lang="ts">
// Initials for up to `max` people, overlapping, then "+N". "--" when nobody is assigned.
import { initials } from '@/ui/format'

withDefaults(defineProps<{ names: readonly string[]; max?: number }>(), { max: 3 })
</script>

<template>
  <span class="avatar-stack">
    <span v-if="!names.length" class="avatar empty" title="Unassigned">--</span>
    <span v-for="name in names.slice(0, max)" :key="name" class="avatar" :title="name">{{
      initials(name)
    }}</span>
    <span v-if="names.length > max" class="avatar more" :title="names.slice(max).join(', ')"
      >+{{ names.length - max }}</span
    >
  </span>
</template>

<style scoped>
.avatar-stack {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
}
.avatar {
  position: relative;
  display: inline-grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 50%;
  background: #e2ece6;
  color: #27654f;
  font-size: 9px;
  font-weight: 800;
}
.avatar + .avatar {
  margin-left: -5px;
  box-shadow: 0 0 0 2px #fff;
}
.avatar:nth-child(1) {
  z-index: 3;
}
.avatar:nth-child(2) {
  z-index: 2;
}
.avatar:nth-child(3) {
  z-index: 1;
}
.empty {
  background: #eef0f2;
  color: #9aa3aa;
}
.more {
  background: #e3e7eb;
  color: #4d5962;
}
</style>
