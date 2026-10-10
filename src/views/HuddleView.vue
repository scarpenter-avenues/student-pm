<script setup lang="ts">
// Huddle: the coaches' and mentors' daily status and session plan. Program coaches post from the Coaches' Dashboard
// (a full huddle or a quick note); mentors read it here from the top-bar Huddle button. Opening the page marks
// everything read. The newest huddle is open; older ones are one-line summaries.
import { computed, nextTick, ref, watch } from 'vue'
import { queries, useLiveQuery, writes } from '@/data'
import type { Huddle, HuddlePlanRow, WithId } from '@/model/types'
import { useHuddles } from '@/composables/useInbox'
import { useNames } from '@/composables/useNames'
import { useTeam } from '@/composables/useTeamData'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import { todayIso } from '@/model/dates'
import { defaultHuddlePlan } from '@/model/huddles'
import { mentionSearch } from '@/ui/mentions'
import HuddleCard from '@/components/huddle/HuddleCard.vue'
import HuddleComposer from '@/components/huddle/HuddleComposer.vue'
import RichEditor from '@/components/ui/RichEditor.vue'

defineProps<{ dashboard?: boolean }>()

const session = useSession()
const toast = useToast()
const team = useTeam()
const { nameOf } = useNames(team)
const { huddles, unread, markRead } = useHuddles()
const adults = useLiveQuery(() => session.isAdult && queries.adults())
const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)

// Opening the page marks everything read (and anything that arrives while it's open).
watch(
  () => unread.value.map((item) => item.id).join(),
  (ids) => {
    if (ids) void markRead()
  },
  { immediate: true },
)

const teams = computed(() => session.teamsById)
const teamList = computed(() => session.teams)
const newestHuddle = computed(
  () => huddles.value.find((item) => item.kind === 'huddle')?.id ?? null,
)
const opened = ref<Set<string>>(new Set())
const isOpen = (item: WithId<Huddle>) => item.id === newestHuddle.value || opened.value.has(item.id)
function toggle(item: WithId<Huddle>) {
  const next = new Set(opened.value)
  if (opened.value.has(item.id)) next.delete(item.id)
  else next.add(item.id)
  opened.value = next
}
// @ mentions (program coaches write huddles, and they can read every member).
const members = useLiveQuery(() => session.isCoach && queries.allMembers())
const mentions = mentionSearch(() => ({
  students: members.data.value
    .filter((m) => m.role === 'student' || m.role === 'lead')
    .map((m) => ({ id: m.id, displayName: m.displayName, teamId: m.teamIds[0] ?? null })),
  adults: members.data.value.filter((m) => m.role === 'coach' || m.role === 'mentor'),
  teams: session.teams,
}))
const adultNames = computed(() =>
  Object.fromEntries(adults.data.value.map((adult) => [adult.id, adult.displayName])),
)
const seenBy = (item: Huddle) =>
  item.readBy.filter((uid) => adults.data.value.some((adult) => adult.id === uid)).length
const lastPlan = computed(() => {
  const last = huddles.value.find((item) => item.kind === 'huddle' && item.plan?.length)
  return last ? { date: last.date, plan: last.plan as HuddlePlanRow[] } : null
})

// ---------- posting (program coaches) ----------
const mode = ref<'huddle' | 'note' | null>(null)
const note = ref({ html: '', text: '' })
// Huddles and quick notes are emailed once the program's email sender is installed (see docs/email.md).
const emailOn = computed(() => !!session.program?.email?.on)
const reach = computed(() =>
  emailOn.value
    ? 'Coaches and mentors get an email, and see it when they sign in.'
    : 'Coaches and mentors see it when they sign in.',
)
function postHuddle(fields: Omit<Huddle, 'kind' | 'authorId' | 'postedAt' | 'readBy'>) {
  writes.postHuddle({ ...fields, kind: 'huddle' }, emailOn.value).catch(fail)
  mode.value = null
  toast.show(`Huddle posted. ${reach.value}`)
}
function postNote() {
  if (!note.value.text.trim()) return
  writes
    .postHuddle(
      {
        kind: 'note',
        date: todayIso(),
        textHtml: note.value.html,
        text: note.value.text.trim(),
      },
      emailOn.value,
    )
    .catch(fail)
  mode.value = null
  note.value = { html: '', text: '' }
  toast.show(`Quick note posted. ${reach.value}`)
}
function onNoteKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    postNote()
  } else if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    mode.value = null
  }
}
const editing = ref<string | null>(null)
function saveEdit(id: string, fields: Parameters<typeof writes.updateHuddle>[1]) {
  writes.updateHuddle(id, fields).catch(fail)
  editing.value = null
  toast.show('Huddle updated')
}
function remove(item: WithId<Huddle>) {
  writes.deleteHuddle(item.id).catch(fail)
  toast.show(item.kind === 'note' ? 'Quick note deleted' : 'Huddle deleted')
}
const noteBox = ref<InstanceType<typeof RichEditor> | null>(null)
watch(mode, async (value) => {
  if (value === 'note') {
    await nextTick()
    noteBox.value?.focus()
  }
})
</script>

<template>
  <section class="huddle-page">
    <h2>Huddle</h2>
    <div v-if="session.isCoach && !mode" class="post-actions">
      <button class="primary-button post" type="button" @click="mode = 'huddle'">
        ＋ New huddle
      </button>
      <button class="quiet-button" type="button" @click="mode = 'note'">＋ Quick note</button>
    </div>
    <HuddleComposer
      v-if="mode === 'huddle'"
      :teams="teamList"
      :last-plan="lastPlan"
      :adults="adults.data.value"
      :mentions="mentions"
      :default-plan="() => defaultHuddlePlan(session.program)"
      @post="postHuddle"
      @cancel="mode = null"
    />
    <form
      v-if="mode === 'note'"
      class="note-composer"
      @submit.prevent="postNote"
      @keydown="onNoteKeydown"
    >
      <div class="rich">
        <RichEditor
          ref="noteBox"
          v-model="note.html"
          placeholder="A quick note for every coach and mentor…"
          label="Quick note"
          :mentions="mentions"
          @change="note = $event"
        />
      </div>
      <div class="note-actions">
        <small>⌘/Ctrl+Enter sends · Esc cancels</small>
        <button type="button" @click="mode = null">Cancel</button>
        <button type="submit" class="save" :disabled="!note.text.trim()">Send</button>
      </div>
    </form>

    <div class="feed">
      <template v-for="item in huddles" :key="item.id">
        <HuddleComposer
          v-if="item.id === editing"
          :huddle="item"
          :teams="teamList"
          :last-plan="lastPlan"
          :adults="adults.data.value"
          :mentions="mentions"
          :default-plan="() => defaultHuddlePlan(session.program)"
          @post="saveEdit(item.id, $event)"
          @cancel="editing = null"
        />
        <HuddleCard
          v-else
          :huddle="item"
          :open="isOpen(item)"
          :author-name="nameOf(item.authorId)"
          :seen-by="seenBy(item)"
          :adults="adults.data.value.length"
          :teams="teams"
          :names="adultNames"
          :can-delete="session.isCoach"
          @toggle="toggle(item)"
          @edit="editing = item.id"
          @delete="remove(item)"
        />
      </template>
      <p v-if="!huddles.length" class="empty">No huddles yet.</p>
    </div>
  </section>
</template>

<style scoped>
.huddle-page {
  max-width: 820px;
}
h2 {
  margin: 0 0 14px;
  font-size: 20px;
}
.post-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}
.post {
  border-color: #356fd1;
  background: #356fd1;
}
.post:hover {
  background: #2b5db3;
}
.note-composer {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--team-line);
  border-radius: 9px;
}
.rich {
  padding: 2px 10px;
  border: 1px solid #d5dce5;
  border-radius: 6px;
}
.rich :deep(.rich-content) {
  min-height: 60px;
  font-size: 14px;
}
.note-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.note-actions small {
  margin-right: auto;
  color: #8a949c;
  font-size: 12px;
}
.note-actions button {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
}
.note-actions .save {
  border-color: #356fd1;
  background: #356fd1;
  color: #fff;
}
.note-actions .save:disabled {
  opacity: 0.55;
}
.feed {
  display: grid;
  gap: 12px;
}
.empty {
  color: var(--muted);
  font-size: 14px;
}
</style>
