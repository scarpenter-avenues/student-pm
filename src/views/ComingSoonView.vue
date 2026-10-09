<script setup lang="ts">
// Stand-in for the views ported from the mock-up in step 7.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { DASHBOARD_TABS, TEAM_TABS } from '@/router/tabs'

const route = useRoute()
const label = computed(() => {
  if (route.name === 'team') return TEAM_TABS.find((tab) => tab.id === route.params.tab)?.label
  if (route.name === 'dashboard')
    return DASHBOARD_TABS.find((tab) => tab.id === route.params.tab)?.label
  if (route.name === 'team-announcements') return 'Announcements'
  if (route.name === 'huddle') return 'Huddle'
  return ''
})
</script>

<template>
  <p class="coming-soon">{{ label }} · not built yet (see mockup/index.html)</p>
</template>

<style scoped>
.coming-soon {
  margin: 48px 0;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}
</style>
