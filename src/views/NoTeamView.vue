<script setup lang="ts">
import { useSession } from '@/stores/session'

const session = useSession()
</script>

<template>
  <section class="no-team">
    <h2>You're not on a team yet</h2>
    <p>Your coach will add you to one. It shows up here as soon as they do.</p>
    <p class="who">Signed in as {{ session.member?.displayName }}</p>
  </section>
</template>

<style scoped>
.no-team {
  max-width: 460px;
  margin: 64px auto;
  text-align: center;
}
h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}
.who {
  margin-top: 14px;
  font-size: 13px;
}
</style>
