<script setup lang="ts">
// Coaches' Dashboard → Settings (program coaches only): seasons, teams, subteam defaults, goal ideas, the default
// huddle plan, and people.
import { computed } from 'vue'
import { queries, refs, useLiveQuery } from '@/data'
import { useSession } from '@/stores/session'
import HuddlePlanSection from '@/components/program/HuddlePlanSection.vue'
import GoalIdeasSection from '@/components/program/GoalIdeasSection.vue'
import PeopleSection from '@/components/program/PeopleSection.vue'
import SeasonsSection from '@/components/program/SeasonsSection.vue'
import SubteamDefaultsSection from '@/components/program/SubteamDefaultsSection.vue'
import TeamsSection from '@/components/program/TeamsSection.vue'

const session = useSession()
const seasons = useLiveQuery(() => refs.seasons())
const teams = useLiveQuery(() => queries.allTeams())
const members = useLiveQuery(() => queries.allMembers())
const invites = useLiveQuery(() => queries.allInvites())
const currentId = computed(() => session.program?.currentSeasonId ?? '')
const season = computed(() => seasons.data.value.find((s) => s.id === currentId.value) ?? null)
const adultMembers = computed(() =>
  members.data.value.filter((m) => m.role === 'coach' || m.role === 'mentor'),
)
const seasonTeams = computed(() =>
  teams.data.value.filter((t) => t.seasonIds.includes(currentId.value)),
)
</script>

<template>
  <section class="program-settings">
    <h2>Program settings</h2>
    <SeasonsSection
      :seasons="seasons.data.value"
      :current-id="currentId"
      :all-teams="teams.data.value"
      :members="members.data.value"
    />
    <TeamsSection
      v-if="season"
      :season="season"
      :all-teams="teams.data.value"
      :members="members.data.value"
      :subteam-defaults="session.program?.subteamDefaults ?? []"
    />
    <SubteamDefaultsSection :defaults="session.program?.subteamDefaults ?? []" />
    <GoalIdeasSection :program="session.program" />
    <HuddlePlanSection :program="session.program" :teams="seasonTeams" :adults="adultMembers" />
    <PeopleSection
      :teams="seasonTeams"
      :members="members.data.value"
      :invites="invites.data.value"
    />
  </section>
</template>

<style scoped>
h2 {
  margin: 0 0 6px;
  font-size: 20px;
}
</style>
