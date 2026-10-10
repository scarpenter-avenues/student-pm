<script setup lang="ts">
// Announcements: a team's feed (its own and program-wide posts), or every post on the Coaches' Dashboard.
// Anyone can post to their own team; mentors to their teams; program coaches to any teams (All teams = program-wide).
// Every post shows its audience beside the title. Authors and program coaches edit and delete.
import { computed, nextTick, ref } from 'vue'
import { writes } from '@/data'
import type { Announcement, WithId } from '@/model/types'
import { useAnnouncements } from '@/composables/useInbox'
import { useNames } from '@/composables/useNames'
import { useTeam } from '@/composables/useTeamData'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import { formatMoment } from '@/ui/format'
import AudienceChips from '@/components/ui/AudienceChips.vue'
import RichEditor from '@/components/ui/RichEditor.vue'
import RichText from '@/components/ui/RichText.vue'
import TeamPicker from '@/components/ui/TeamPicker.vue'

const props = defineProps<{ dashboard?: boolean }>()

const session = useSession()
const toast = useToast()
const team = useTeam()
const { nameOf } = useNames(team)
const { announcements, unread, markRead } = useAnnouncements(() =>
  props.dashboard ? 'all' : team.teamId.value,
)
const unreadIds = computed(() => new Set(unread.value.map((item) => item.id)))
const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)

const teams = computed(() => {
  const own = team.team.value ? { [team.team.value.id]: team.team.value } : {}
  return { ...session.teamsById, ...own }
})
/** Who you can post to: coaches any team; mentors their teams; students and leads their own team. */
const allowed = computed(() => {
  if (session.isCoach) return session.teams
  const ids = session.member?.teamIds ?? []
  return ids.flatMap((id) => (teams.value[id] ? [teams.value[id]!] : []))
})

// ---------- composer ----------
const composing = ref(false)
const editingId = ref<string | null>(null)
const title = ref('')
const html = ref('')
const text = ref('')
const audience = ref<string[]>([])
// Email is offered only once the program's email sender is installed (see docs/email.md).
const emailOn = computed(() => !!session.program?.email?.on)
const email = ref(true)
const titleInput = ref<HTMLInputElement | null>(null)

async function compose(item: WithId<Announcement> | null = null) {
  editingId.value = item?.id ?? null
  title.value = item?.title ?? ''
  html.value = item?.bodyHtml ?? ''
  text.value = item?.body ?? ''
  audience.value = item
    ? item.audience.includes('all')
      ? session.teams.map((t) => t.id)
      : [...item.audience]
    : props.dashboard && session.isCoach
      ? session.teams.map((t) => t.id)
      : allowed.value.filter((t) => t.id === team.teamId.value).map((t) => t.id)
  if (!audience.value.length && allowed.value[0]) audience.value = [allowed.value[0].id]
  email.value = true
  composing.value = true
  await nextTick()
  titleInput.value?.focus()
}
function cancel() {
  composing.value = false
  editingId.value = null
}
function post() {
  const cleanTitle = title.value.replace(/\s+/g, ' ').trim()
  if (!cleanTitle) return titleInput.value?.focus()
  if (!text.value.trim()) return toast.show('Add a message to the announcement')
  if (!audience.value.length) return toast.show('Pick at least one team to send to')
  // Every team in the program (picked by a program coach) means program-wide.
  const everyone = session.isCoach && session.teams.every((t) => audience.value.includes(t.id))
  const fields = {
    title: cleanTitle,
    bodyHtml: html.value,
    body: text.value.replace(/\s+/g, ' ').trim(),
    audience: everyone ? ['all'] : audience.value,
  }
  if (editingId.value) {
    writes.updateAnnouncement(editingId.value, fields).catch(fail)
    toast.show('Announcement updated')
  } else {
    writes.postAnnouncement({ ...fields, emailed: emailOn.value && email.value }).catch(fail)
    const names = audience.value.map((id) => teams.value[id]?.name).filter(Boolean)
    toast.show(everyone ? 'Posted to all teams' : `Posted to ${names.join(', ')}`)
  }
  cancel()
}
function remove(item: WithId<Announcement>) {
  writes.deleteAnnouncement(item.id).catch(fail)
  toast.show('Announcement deleted', {
    label: 'Undo',
    run: () => writes.restoreAnnouncement(item).catch(fail),
  })
}
const canManage = (item: Announcement) => session.isCoach || item.authorId === session.member?.id
</script>

<template>
  <section class="announcements-page">
    <div class="page-head">
      <div>
        <p v-if="!dashboard && team.team.value" class="eyebrow">
          {{ team.team.value.name
          }}<template v-if="team.team.value.number"> · FTC {{ team.team.value.number }}</template>
        </p>
        <h2>Announcements</h2>
      </div>
      <div class="head-actions">
        <button v-if="!composing" class="primary-button new" type="button" @click="compose()">
          ＋ New announcement
        </button>
        <RouterLink
          v-if="!dashboard && team.teamId.value"
          class="quiet-button"
          :to="{ name: 'team', params: { teamId: team.teamId.value, tab: 'board' } }"
        >
          ← Back to team board
        </RouterLink>
      </div>
    </div>

    <form v-if="composing" class="composer" @submit.prevent="post">
      <input
        ref="titleInput"
        v-model="title"
        maxlength="80"
        placeholder="Announcement title"
        aria-label="Announcement title"
        autocomplete="off"
      />
      <div class="composer-row">
        <span class="audience">
          <span>Send to</span>
          <TeamPicker
            v-model="audience"
            label="Send to"
            :teams="allowed"
            :limited="!session.isCoach"
          />
        </span>
        <label v-if="!editingId && emailOn" class="email"
          ><input v-model="email" type="checkbox" /> Also send by email</label
        >
      </div>
      <div class="body">
        <RichEditor
          v-model="html"
          placeholder="Write the announcement. Type # for a heading or - for a list."
          label="Announcement"
          @change="text = $event.text"
        />
      </div>
      <p class="hint">Keep personal details out of announcements.</p>
      <div class="composer-actions">
        <button type="button" @click="cancel">Cancel</button>
        <button type="submit" class="save">{{ editingId ? 'Save' : 'Post announcement' }}</button>
      </div>
    </form>

    <ul class="feed">
      <li
        v-for="item in announcements"
        :key="item.id"
        class="item"
        :class="{ unread: unreadIds.has(item.id) }"
      >
        <span v-if="unreadIds.has(item.id)" class="dot" aria-label="Unread" />
        <div class="item-copy">
          <h3>
            {{ item.title }}
            <AudienceChips :audience="item.audience" :teams="teams" />
          </h3>
          <RichText class="item-body" :html="item.bodyHtml" :label="item.title" />
          <p class="meta">{{ nameOf(item.authorId) }} · {{ formatMoment(item.postedAt) }}</p>
        </div>
        <div class="item-actions">
          <button v-if="unreadIds.has(item.id)" type="button" @click="markRead([item.id])">
            Mark as read
          </button>
          <template v-if="canManage(item)">
            <button type="button" @click="compose(item)">Edit</button>
            <button type="button" class="delete" @click="remove(item)">Delete</button>
          </template>
        </div>
      </li>
      <li v-if="!announcements.length" class="empty">No announcements yet.</li>
    </ul>
  </section>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.eyebrow {
  margin: 0 0 4px;
  color: #6b757e;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1.2px;
  text-transform: uppercase;
}
h2 {
  margin: 0;
  font-size: 20px;
}
.head-actions {
  display: flex;
  gap: 8px;
}
.new {
  border-color: #356fd1;
  background: #356fd1;
}
.new:hover {
  background: #2b5db3;
}
.composer {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
  padding: 14px;
  border: 1px solid var(--team-line);
  border-radius: 9px;
}
.composer > input {
  height: 38px;
  padding: 0 10px;
  border: 1px solid #d5dce5;
  border-radius: 6px;
  font-size: 15px;
  font-weight: 650;
}
.composer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}
.audience {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #59636d;
  font-size: 13px;
}
.email {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #59636d;
  font-size: 13px;
}
.body {
  padding: 4px 12px;
  border: 1px solid #d5dce5;
  border-radius: 6px;
}
.body :deep(.rich-content) {
  min-height: 110px;
}
.hint {
  margin: 0;
  color: #737d86;
  font-size: 12px;
}
.composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.composer-actions button {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
}
.composer-actions .save {
  border-color: #356fd1;
  background: #356fd1;
  color: #fff;
  font-weight: 650;
}
.feed {
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
  list-style: none;
}
.item {
  position: relative;
  display: flex;
  gap: 16px;
  padding: 18px 10px 16px 25px;
  border-bottom: 1px solid var(--line);
}
.item.unread {
  background: var(--team-softer);
}
.dot {
  position: absolute;
  top: 26px;
  left: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #356fd1;
}
.item-copy {
  flex: 1;
  min-width: 0;
}
.item-copy > :not(h3) {
  max-width: 720px;
}
h3 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 6px;
  font-size: 19px;
}
.item-body :deep(.rich-content) {
  min-height: 0;
  color: #59636d;
  font-size: 14px;
  line-height: 1.6;
}
.item-body :deep(p) {
  margin: 0.2em 0;
}
.meta {
  margin: 8px 0 0;
  color: #8a949c;
  font-size: 12px;
}
.item-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  gap: 10px;
}
.item-actions button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #737d86;
  font-size: 12px;
}
.item-actions button:hover {
  color: var(--team-ink);
}
.item-actions .delete:hover {
  color: #a43d34;
}
.empty {
  padding: 18px 10px;
  color: var(--muted);
  font-size: 14px;
}
@media (max-width: 680px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .item {
    flex-direction: column;
    gap: 6px;
  }
}
</style>
