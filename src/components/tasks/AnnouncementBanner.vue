<script setup lang="ts">
// On the task tabs: every unread announcement for this team, each with its own "Mark read".
import { computed } from 'vue'
import { useAnnouncements } from '@/composables/useInbox'
import { useTeam } from '@/composables/useTeamData'
import { useSession } from '@/stores/session'
import AudienceChips from '@/components/ui/AudienceChips.vue'

const team = useTeam()
const session = useSession()
const { unread, markRead } = useAnnouncements(() => team.teamId.value)
const teams = computed(() => {
  const own = team.team.value ? { [team.team.value.id]: team.team.value } : {}
  return { ...session.teamsById, ...own }
})
</script>

<template>
  <section
    v-if="unread.length"
    class="announcement"
    :class="{ multiple: unread.length > 1 }"
    aria-label="Unread announcements"
  >
    <span class="announcement-mark" aria-hidden="true">!</span>
    <div class="announcement-copy">
      <div v-for="item in unread" :key="item.id" class="banner-item">
        <div class="banner-item-copy">
          <strong>
            New from {{ team.nameOf(item.authorId) }} · {{ item.title }}
            <AudienceChips :audience="item.audience" :teams="teams" />
          </strong>
          <p>{{ item.body }}</p>
        </div>
        <button type="button" class="mark-read" @click="markRead([item.id])">Mark read</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.announcement {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  margin-bottom: 23px;
  padding: 13px 14px;
  border: 1px solid var(--team-line);
  border-left: 3px solid var(--team-line);
  border-radius: 7px;
  background: var(--team-softer);
}
.announcement-mark {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border-radius: 50%;
  background: var(--team-soft);
  color: var(--team-ink);
  font-size: 13px;
  font-weight: 800;
}
.announcement-copy {
  display: grid;
  min-width: 0;
}
.banner-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}
.banner-item + .banner-item {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--team-line);
}
.banner-item-copy {
  flex: 1;
  min-width: 0;
}
strong {
  display: block;
  margin-bottom: 3px;
  font-size: 13px;
}
p {
  overflow: hidden;
  margin: 0;
  color: #606870;
  font-size: 15px;
  line-height: 1.55;
  text-overflow: ellipsis;
}
.multiple p {
  white-space: nowrap;
}
.mark-read {
  flex: 0 0 auto;
  padding: 1px 0 5px;
  border: 0;
  background: none;
  color: #727a73;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
}
.mark-read:hover {
  color: var(--team-ink);
}
@media (max-width: 680px) {
  .announcement {
    grid-template-columns: 27px minmax(0, 1fr);
    gap: 9px;
  }
  p {
    font-size: 14px;
  }
}
</style>
