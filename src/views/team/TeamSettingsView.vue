<script setup lang="ts">
// Team Settings: the team's look (program coaches and its mentors), members, subteams, GitHub, and archived tasks.
import { useTeam } from '@/composables/useTeamData'
import AnnouncementBanner from '@/components/tasks/AnnouncementBanner.vue'
import ArchivedSection from '@/components/settings/ArchivedSection.vue'
import GithubSection from '@/components/settings/GithubSection.vue'
import MembersSection from '@/components/settings/MembersSection.vue'
import SubteamsSection from '@/components/settings/SubteamsSection.vue'
import TeamProfileSection from '@/components/settings/TeamProfileSection.vue'

const team = useTeam()
</script>

<template>
  <AnnouncementBanner />
  <div v-if="team.team.value" class="team-settings">
    <h2>Team settings</h2>
    <p class="label">
      {{ team.team.value.name
      }}<template v-if="team.team.value.number"> · FTC {{ team.team.value.number }}</template>
    </p>
    <TeamProfileSection v-if="team.can.value.manage" :team="team.team.value" editable />
    <MembersSection :team="team" />
    <SubteamsSection :team="team" />
    <GithubSection :team="team.team.value" :editable="team.can.value.manage" />
    <ArchivedSection :team="team" />
  </div>
</template>

<style scoped>
h2 {
  margin: 0;
  font-size: 20px;
}
.label {
  margin: 4px 0 18px;
  color: #66717a;
  font-size: 13px;
}
</style>
