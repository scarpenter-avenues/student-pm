<script setup lang="ts">
// The top bar's first row: team badge and name (with the ⌄ switcher for program coaches and multi-team mentors),
// then the next-competition countdown, Huddle (adults, with unread count), Announcements (unread count), and the
// profile menu.
import { computed, ref } from 'vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import { useSession } from '@/stores/session'
import { useMenu } from '@/composables/useMenu'
import { ROLE_LABELS, type Team, type WithId } from '@/model/types'
import { daysAway, formatEventDate, initials } from '@/ui/format'
import { useAnnouncements, useHuddles } from '@/composables/useInbox'
import { useNextCompetition } from '@/composables/useNextCompetition'
import { DEFAULT_TEAM_TAB } from '@/router/tabs'
import TeamBadge from './TeamBadge.vue'

const props = defineProps<{
  /** The team being shown, or null on the Coaches' Dashboard. */
  team: WithId<Team> | null
  onDashboard: boolean
}>()

const session = useSession()
const route = useRoute()

const title = computed(() => (props.onDashboard ? "Coaches' Dashboard" : (props.team?.name ?? '')))
const canSwitch = computed(
  () => session.isCoach || (session.role === 'mentor' && session.teams.length > 1),
)

// ---------- team switcher ----------
const switcherRoot = ref<HTMLElement | null>(null)
const switcherButton = ref<HTMLElement | null>(null)
const switcher = useMenu(switcherRoot, switcherButton)

/** Switching teams keeps the tab you're on. */
function teamLink(teamId: string): RouteLocationRaw {
  const tab = route.name === 'team' ? route.params.tab : DEFAULT_TEAM_TAB
  return { name: 'team', params: { teamId, tab } }
}

// ---------- profile ----------
const profileRoot = ref<HTMLElement | null>(null)
const profileButton = ref<HTMLElement | null>(null)
const profile = useMenu(profileRoot, profileButton)
const name = computed(() => session.member?.displayName ?? '')

// ---------- counts and countdown ----------
const feedTeamId = () => (props.onDashboard ? 'all' : (props.team?.id ?? null))
const announcements = useAnnouncements(feedTeamId)
const huddles = useHuddles()
// Hidden on the Coaches' Dashboard.
const competition = useNextCompetition(() => (props.onDashboard ? null : (props.team?.id ?? null)))

const huddleLink = computed<RouteLocationRaw>(() =>
  session.isCoach ? { name: 'dashboard', params: { tab: 'huddle' } } : { name: 'huddle' },
)
const announcementsLink = computed<RouteLocationRaw | null>(() => {
  if (props.onDashboard) return { name: 'dashboard', params: { tab: 'announcements' } }
  return props.team ? { name: 'team-announcements', params: { teamId: props.team.id } } : null
})
</script>

<template>
  <div class="topbar-primary">
    <div ref="switcherRoot" class="workspace-title" @keydown="switcher.onKeydown">
      <TeamBadge v-if="team || onDashboard" :team="onDashboard ? null : team" />
      <h1 :class="{ 'can-switch': canSwitch }" @click="canSwitch && switcher.toggle()">
        {{ title }}
      </h1>
      <button
        v-if="canSwitch"
        ref="switcherButton"
        class="team-menu"
        type="button"
        aria-label="Switch team"
        aria-haspopup="menu"
        :aria-expanded="switcher.open.value"
        @click="switcher.toggle()"
      >
        ⌄
      </button>
      <div v-if="switcher.open.value" class="menu switch-menu" role="menu">
        <p class="menu-label">Switch view</p>
        <template v-if="session.isCoach">
          <RouterLink
            class="menu-item switch-item"
            role="menuitem"
            :to="{ name: 'dashboard', params: { tab: 'huddle' } }"
            :aria-current="onDashboard ? 'page' : undefined"
            @click="switcher.close()"
          >
            <TeamBadge :team="null" size="small" />
            <span class="switch-copy">
              <strong>Coaches' Dashboard</strong>
              <small>Every team's tasks and goals · {{ session.teams.length }} teams</small>
            </span>
          </RouterLink>
          <hr />
        </template>
        <RouterLink
          v-for="option in session.teams"
          :key="option.id"
          class="menu-item switch-item"
          role="menuitem"
          :to="teamLink(option.id)"
          :aria-current="!onDashboard && team?.id === option.id ? 'page' : undefined"
          @click="switcher.close()"
        >
          <TeamBadge :team="option" size="small" />
          <span class="switch-copy">
            <strong>{{ option.name }}</strong>
            <small v-if="option.number">FTC {{ option.number }}</small>
          </span>
        </RouterLink>
      </div>
    </div>

    <div class="top-actions">
      <span
        v-if="competition"
        class="countdown-chip"
        :title="`Next competition: ${competition.title}, ${formatEventDate(competition.date)}`"
      >
        🏆
        <span class="countdown-name"
          >{{ competition.title }} · {{ formatEventDate(competition.date) }} ·
        </span>
        <strong>{{ daysAway(competition.days) }}</strong>
      </span>
      <RouterLink v-if="session.isAdult && !onDashboard" class="quiet-button" :to="huddleLink">
        Huddle
        <span v-if="huddles.unread.value.length" class="tab-count">{{
          huddles.unread.value.length
        }}</span>
      </RouterLink>
      <RouterLink
        v-if="announcementsLink"
        class="quiet-button announcements-button"
        :to="announcementsLink"
        aria-label="Announcements"
      >
        <span class="announcement-label">Announcements</span>
        <span v-if="announcements.unread.value.length" class="tab-count">{{
          announcements.unread.value.length
        }}</span>
      </RouterLink>
      <div ref="profileRoot" class="profile" @keydown="profile.onKeydown">
        <button
          ref="profileButton"
          class="icon-button profile-button"
          type="button"
          aria-label="Profile"
          aria-haspopup="menu"
          :aria-expanded="profile.open.value"
          @click="profile.toggle()"
        >
          {{ initials(name) }}
        </button>
        <div v-if="profile.open.value" class="menu profile-menu" role="menu">
          <p class="profile-who">
            Signed in as {{ name }} · {{ session.role ? ROLE_LABELS[session.role] : '' }}
          </p>
          <button class="menu-item" type="button" role="menuitem" @click="session.signOut()">
            Sign out
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topbar-primary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-width: 0;
}
.workspace-title {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1 1 auto;
  min-width: 0;
}
.workspace-title h1 {
  margin: 0;
  overflow: hidden;
  font-size: 20px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
h1.can-switch {
  cursor: pointer;
}
h1.can-switch:hover {
  color: var(--team-ink);
}
.team-menu {
  padding: 3px;
  border: 0;
  background: transparent;
  color: #7c8582;
}
.switch-menu {
  top: calc(100% + 10px);
  left: 0;
  min-width: 280px;
}
.switch-item {
  padding: 6px 8px;
}
.switch-item[aria-current] {
  box-shadow: inset 3px 0 0 #2c343b;
  background: #f6f7f9;
}
.switch-copy {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.switch-copy strong {
  font-size: 14px;
}
.switch-copy small {
  color: #737d86;
  font-size: 12px;
}
.top-actions {
  display: flex;
  align-items: center;
  gap: 9px;
}
.top-actions .router-link-active {
  background: var(--team-soft);
  color: var(--team-ink);
}
.countdown-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 14px;
  background: #f1ecfb;
  color: #5b3fa6;
  font-size: 12px;
  font-weight: 650;
  white-space: pre;
}
.countdown-chip strong {
  font-weight: 800;
}
.profile {
  position: relative;
}
.profile-button {
  font-size: 13px;
}
.profile-menu {
  top: calc(100% + 6px);
  right: 0;
}
.profile-who {
  margin: 4px 8px 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
  color: #2c343b;
  font-size: 13px;
  font-weight: 650;
}

@media (max-width: 680px) {
  .topbar-primary {
    gap: 8px;
  }
  .workspace-title h1 {
    max-width: 138px;
    font-size: 18px;
  }
  .top-actions {
    flex: 0 0 auto;
    gap: 5px;
  }
  .announcement-label {
    display: none;
  }
  .countdown-name {
    display: none;
  }
  .announcements-button {
    position: relative;
    width: 32px;
    padding: 0;
    font-size: 14px;
  }
  .announcements-button::before {
    content: '◉';
  }
  .announcements-button .tab-count {
    position: absolute;
    top: -4px;
    right: -5px;
    min-width: 14px;
    padding: 1px 3px;
    border: 1px solid white;
    font-size: 8px;
  }
  .profile-button {
    width: 30px;
    min-width: 30px;
  }
}
</style>
