<script setup lang="ts">
// A Coaches' Dashboard tab: picks the view for /dashboard/:tab.
import { computed, defineAsyncComponent, type Component } from 'vue'
import { useRoute } from 'vue-router'
import ComingSoonView from '@/views/ComingSoonView.vue'

const route = useRoute()
const views: Record<string, { component: Component; props?: Record<string, unknown> }> = {
  huddle: {
    component: defineAsyncComponent(() => import('@/views/HuddleView.vue')),
    props: { dashboard: true },
  },
  tasks: { component: defineAsyncComponent(() => import('./DashboardTasksView.vue')) },
  goals: { component: defineAsyncComponent(() => import('./DashboardGoalsView.vue')) },
  announcements: {
    component: defineAsyncComponent(() => import('@/views/AnnouncementsView.vue')),
    props: { dashboard: true },
  },
}
const view = computed(() => views[String(route.params.tab)] ?? { component: ComingSoonView })
</script>

<template>
  <component :is="view.component" v-bind="view.props ?? {}" />
</template>
