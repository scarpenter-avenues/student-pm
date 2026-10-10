<script setup lang="ts">
// A team tab: picks the view for /t/:teamId/:tab.
import { computed, defineAsyncComponent, type Component } from 'vue'
import { useRoute } from 'vue-router'
import ComingSoonView from '@/views/ComingSoonView.vue'

const route = useRoute()
const BoardView = defineAsyncComponent(() => import('./BoardView.vue'))
const ListView = defineAsyncComponent(() => import('./ListView.vue'))
const PlanningView = defineAsyncComponent(() => import('./PlanningView.vue'))
const TimelineView = defineAsyncComponent(() => import('./TimelineView.vue'))
const TeamHomeView = defineAsyncComponent(() => import('./TeamHomeView.vue'))
const views: Record<string, { component: Component; props?: Record<string, unknown> }> = {
  board: { component: BoardView },
  'my-tasks': { component: BoardView, props: { mine: true } },
  list: { component: ListView },
  planning: { component: PlanningView },
  timeline: { component: TimelineView },
  home: { component: TeamHomeView },
}
const view = computed(() => views[String(route.params.tab)] ?? { component: ComingSoonView })
</script>

<template>
  <component :is="view.component" v-bind="view.props ?? {}" />
</template>
