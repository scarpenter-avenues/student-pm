<script setup lang="ts">
// A team tab: picks the view for /t/:teamId/:tab.
import { computed, defineAsyncComponent, type Component } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const BoardView = defineAsyncComponent(() => import('./BoardView.vue'))
const ListView = defineAsyncComponent(() => import('./ListView.vue'))
const PlanningView = defineAsyncComponent(() => import('./PlanningView.vue'))
const TimelineView = defineAsyncComponent(() => import('./TimelineView.vue'))
const TeamHomeView = defineAsyncComponent(() => import('./TeamHomeView.vue'))
const TeamGoalsView = defineAsyncComponent(() => import('./TeamGoalsView.vue'))
const TeamSettingsView = defineAsyncComponent(() => import('./TeamSettingsView.vue'))
const views: Record<string, { component: Component; props?: Record<string, unknown> }> = {
  board: { component: BoardView },
  'my-tasks': { component: BoardView, props: { mine: true } },
  list: { component: ListView },
  planning: { component: PlanningView },
  timeline: { component: TimelineView },
  home: { component: TeamHomeView },
  goals: { component: TeamGoalsView },
  settings: { component: TeamSettingsView },
}
const view = computed(() => views[String(route.params.tab)] ?? null)
</script>

<template>
  <component :is="view.component" v-if="view" v-bind="view.props ?? {}" />
</template>
