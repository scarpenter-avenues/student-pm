<script setup lang="ts">
import { usingEmulators } from './firebase'
</script>

<template>
  <main class="placeholder">
    <h1>Switchback</h1>
    <p>Team boards, sprints, and learning goals for student teams.</p>
    <p v-if="usingEmulators" class="note">Running against the local Firebase emulators.</p>
    <RouterView />
  </main>
</template>

<style scoped>
.placeholder {
  max-width: 640px;
  margin: 64px auto;
  padding: 0 16px;
  font-family: system-ui, sans-serif;
}
.note {
  color: #66717a;
  font-size: 14px;
}
</style>
