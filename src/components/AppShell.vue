<script setup lang="ts">
// The signed-in layout: top bar, tabs (team or Coaches' Dashboard), and the page.
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useSession } from '@/stores/session'
import { teamAccent } from '@/ui/teamColor'
import { DASHBOARD_TABS, TEAM_TABS } from '@/router/tabs'
import { createTeamData, provideTeam } from '@/composables/useTeamData'
import TopBar from './TopBar.vue'
import TaskPanel from './TaskPanel.vue'
import HuddlePopup from './huddle/HuddlePopup.vue'
import GoalFlowHost from './goals/GoalFlowHost.vue'
import { needsAttention, needsOf, useMyGoals } from '@/composables/useGoals'

const session = useSession()
const route = useRoute()

const onDashboard = computed(() => route.name === 'dashboard')

// Pages without a team in the URL (Huddle, No team) keep showing the last team you were on.
const lastTeamId = ref<string | null>(null)
watch(
  () => route.params.teamId,
  (teamId) => {
    if (typeof teamId === 'string') lastTeamId.value = teamId
  },
  { immediate: true },
)
const teamId = computed(() => lastTeamId.value ?? session.member?.teamIds[0] ?? null)
// The team's shared data for every team page (not the Coaches' Dashboard, which loads each team itself).
const teamData = createTeamData(() => (onDashboard.value ? null : teamId.value))
provideTeam(teamData)
const team = computed(() =>
  teamId.value ? (session.teamsById[teamId.value] ?? teamData.team.value ?? null) : null,
)

const tabs = computed(() => {
  if (onDashboard.value)
    return { list: DASHBOARD_TABS, to: (tab: string) => ({ name: 'dashboard', params: { tab } }) }
  if (!teamId.value) return null
  const id = teamId.value
  return { list: TEAM_TABS, to: (tab: string) => ({ name: 'team', params: { teamId: id, tab } }) }
})
const activeTab = computed(() =>
  route.name === 'team' || route.name === 'dashboard' ? route.params.tab : null,
)

// Students: a dot on the Goals tab when a goal needs them (or they have none yet).
const myGoals = useMyGoals()
const goalsDot = computed(() => {
  if (session.isAdult || !session.member || myGoals.loading.value) return false
  const active = myGoals.active.value
  return (
    !active.length || active.some((goal) => needsAttention(needsOf(goal, teamData.sprints.value)))
  )
})

// Team colors tint the whole app (menus included), so the variables go on the root element.
watchEffect(() => {
  const vars = teamAccent(team.value?.color)
  Object.entries(vars).forEach(([name, value]) =>
    document.documentElement.style.setProperty(name, value),
  )
})
watchEffect(() => {
  const name = onDashboard.value ? "Coaches' Dashboard" : team.value?.name
  document.title = name ? `${name} · Switchback` : 'Switchback'
})
</script>

<template>
  <div class="app">
    <header class="topbar">
      <TopBar :team="team" :on-dashboard="onDashboard" />
      <nav
        v-if="tabs"
        class="tabs-row"
        :aria-label="onDashboard ? 'Coaches\' Dashboard views' : 'Team views'"
      >
        <RouterLink
          v-for="tab in tabs.list"
          :key="tab.id"
          class="top-tab"
          :class="{
            active: activeTab === tab.id,
            'settings-tab': tab.gear,
            'has-dot': tab.id === 'goals' && !onDashboard && goalsDot,
          }"
          :to="tabs.to(tab.id)"
          :aria-current="activeTab === tab.id ? 'page' : undefined"
        >
          <!-- Lucide "settings" icon, lucide-static v1.53.0, ISC license (https://lucide.dev/license) -->
          <svg
            v-if="tab.gear"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
            />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {{ tab.label }}
        </RouterLink>
      </nav>
    </header>
    <main class="content">
      <RouterView />
    </main>
    <TaskPanel />
    <HuddlePopup />
    <GoalFlowHost v-if="!onDashboard" />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
}
.topbar {
  position: sticky;
  z-index: 5;
  top: 0;
  display: grid;
  grid-template-rows: 55px auto;
  padding: 0 clamp(16px, 2vw, 28px);
  border-bottom: 1px solid var(--line);
  background: #fff;
}
.tabs-row {
  display: flex;
  align-items: stretch;
  gap: 4px;
  height: 43px;
  min-width: 0;
  overflow-x: auto;
}
.top-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 7px;
  padding: 0 12px;
  border-radius: 6px 6px 0 0;
  color: #626d6a;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.top-tab:hover {
  background: #f5f7fa;
}
.top-tab.active {
  background: var(--team-soft);
  color: var(--team-ink);
}
.settings-tab {
  margin-left: auto;
}
.has-dot::after {
  position: absolute;
  top: 9px;
  right: 4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d9534f;
  content: '';
}
.content {
  width: 100%;
  margin: 0 auto;
  padding: 21px clamp(16px, 2vw, 28px) 50px;
}

@media (max-width: 680px) {
  .topbar {
    grid-template-rows: 50px auto;
    padding: 0 12px;
  }
  .tabs-row {
    height: 40px;
  }
  .top-tab {
    padding: 0 11px;
  }
  .content {
    padding: 18px 13px 34px;
  }
}
</style>
