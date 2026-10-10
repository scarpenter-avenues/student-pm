<script setup lang="ts">
// Team Home: the team's notes (rich text; Edit / Cancel / Save at the top right), the GitHub repo card when one is
// connected, and the Events column: the next 5 upcoming, then "Show all upcoming (N)", and past events on request.
// Anyone on the team edits the notes and team events; program-wide events (no chip) are program coaches' to edit.
import { computed, ref } from 'vue'
import { refs, useLiveDoc, writes } from '@/data'
import { daysBetween, todayIso } from '@/model/dates'
import type { CalendarEvent } from '@/model/types'
import { useTeam } from '@/composables/useTeamData'
import { EVENT_ICONS, useEvents, type TeamEvent } from '@/composables/useEvents'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import { formatEventDate } from '@/ui/format'
import AnnouncementBanner from '@/components/tasks/AnnouncementBanner.vue'
import EventForm from '@/components/home/EventForm.vue'
import RichEditor from '@/components/ui/RichEditor.vue'
import RichText from '@/components/ui/RichText.vue'

const team = useTeam()
const session = useSession()
const toast = useToast()
const teamId = computed(() => team.teamId.value!)
const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)

// ---------- notes ----------
const page = useLiveDoc(() => team.teamId.value && refs.homePage(team.teamId.value))
const editing = ref(false)
const draft = ref('')
function edit() {
  draft.value = page.data.value?.html ?? ''
  editing.value = true
}
function save() {
  writes.saveHomePage(teamId.value, draft.value).catch(fail)
  editing.value = false
  toast.show('Team Home saved')
}

// ---------- GitHub ----------
const repo = computed(() => team.team.value?.github.repo ?? null)

// ---------- events ----------
const { events } = useEvents(() => team.teamId.value)
const today = todayIso()
const LIMIT = 5
const showAll = ref(false)
const showPast = ref(false)
const upcoming = computed(() => events.value.filter((event) => event.date >= today))
const past = computed(() => events.value.filter((event) => event.date < today).reverse())
const shown = computed(() => (showAll.value ? upcoming.value : upcoming.value.slice(0, LIMIT)))
const canEdit = (event: TeamEvent) => event.scope === 'team' || session.isCoach
const editingEvent = ref<string | 'new' | null>(null)

function relative(iso: string) {
  const offset = daysBetween(today, iso)
  if (offset === 0) return 'today'
  if (offset === 1) return 'tomorrow'
  if (offset === -1) return 'yesterday'
  return offset > 0 ? `in ${offset} days` : `${-offset} days ago`
}
function open(event: TeamEvent) {
  if (canEdit(event)) editingEvent.value = event.id
  else toast.show('Program-wide events are managed by program coaches.')
}
function saveEvent(event: TeamEvent | null, fields: CalendarEvent, scope: 'team' | 'program') {
  const where = (event?.scope ?? scope) === 'program' ? null : teamId.value
  writes.saveEvent(where, event?.id ?? null, fields).catch(fail)
  editingEvent.value = null
  toast.show(
    event ? 'Event updated' : scope === 'program' ? 'Event added for all teams' : 'Event added',
  )
}
function removeEvent(event: TeamEvent) {
  writes.deleteEvent(event.scope === 'program' ? null : teamId.value, event.id).catch(fail)
  editingEvent.value = null
  const scope = event.scope
  const fields: CalendarEvent = {
    title: event.title,
    date: event.date,
    time: event.time,
    location: event.location,
    type: event.type,
    conditional: event.conditional,
  }
  toast.show(scope === 'program' ? 'Event deleted for all teams' : 'Event deleted', {
    label: 'Undo',
    run: () =>
      writes.saveEvent(scope === 'program' ? null : teamId.value, event.id, fields).catch(fail),
  })
}
</script>

<template>
  <AnnouncementBanner />
  <div class="home">
    <section class="notes">
      <div class="notes-actions">
        <template v-if="editing">
          <button class="quiet-button" type="button" @click="editing = false">Cancel</button>
          <button class="primary-button save" type="button" @click="save">Save</button>
        </template>
        <button v-else class="quiet-button" type="button" @click="edit">Edit</button>
      </div>
      <RichEditor
        v-if="editing"
        v-model="draft"
        class="notes-editor"
        placeholder="Robot references, meeting notes, team procedures…"
        label="Team Home notes"
      />
      <RichText
        v-else-if="page.data.value?.html"
        :html="page.data.value.html"
        label="Team Home notes"
      />
      <p v-else-if="!page.loading.value" class="empty">
        Nothing here yet. Use Edit to add robot references, meeting notes, and team procedures.
      </p>
    </section>

    <aside class="side">
      <a
        v-if="repo"
        class="github-card"
        :href="`https://github.com/${repo}`"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
        <span>
          <strong>{{ repo }}</strong>
          <small>Code repository on GitHub ↗</small>
        </span>
      </a>

      <div class="events-head">
        <h2>Events</h2>
        <button class="quiet-button" type="button" @click="editingEvent = 'new'">
          ＋ Add event
        </button>
      </div>
      <EventForm
        v-if="editingEvent === 'new'"
        :event="null"
        :team-name="team.team.value?.name ?? ''"
        :can-post-program="session.isCoach"
        @save="(fields, scope) => saveEvent(null, fields, scope)"
        @cancel="editingEvent = null"
      />
      <ul class="event-list">
        <li v-for="event in shown" :key="`${event.scope}-${event.id}`">
          <EventForm
            v-if="editingEvent === event.id"
            :event="event"
            :team-name="team.team.value?.name ?? ''"
            :can-post-program="session.isCoach"
            @save="(fields, scope) => saveEvent(event, fields, scope)"
            @remove="removeEvent(event)"
            @cancel="editingEvent = null"
          />
          <button
            v-else
            type="button"
            class="event-item"
            :class="{ 'read-only': !canEdit(event) }"
            :data-type="event.type"
            :aria-label="`${canEdit(event) ? 'Edit' : 'View'} ${event.title}, ${formatEventDate(event.date)}`"
            @click="open(event)"
          >
            <span class="event-icon" aria-hidden="true">{{ EVENT_ICONS[event.type] }}</span>
            <span class="event-copy">
              <strong>{{ event.title }}</strong>
              <span v-if="event.conditional" class="event-pill">If qualified</span>
              <small>
                {{ formatEventDate(event.date)
                }}<template v-if="event.time"> · {{ event.time }}</template> ·
                <b v-if="event.type === 'Competition' && !event.conditional">{{
                  relative(event.date)
                }}</b>
                <template v-else>{{ relative(event.date) }}</template>
              </small>
              <small v-if="event.location" class="location">{{ event.location }}</small>
            </span>
          </button>
        </li>
        <li v-if="!upcoming.length" class="empty">
          No upcoming events. Add competitions and work sessions here.
        </li>
      </ul>
      <button
        v-if="upcoming.length > LIMIT"
        type="button"
        class="text-link"
        :aria-expanded="showAll"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show fewer' : `Show all upcoming (${upcoming.length})` }}
      </button>
      <button
        v-if="past.length"
        type="button"
        class="text-link"
        :aria-expanded="showPast"
        @click="showPast = !showPast"
      >
        {{ showPast ? 'Hide' : 'Show' }} past events ({{ past.length }})
      </button>
      <ul v-if="showPast" class="event-list past">
        <li v-for="event in past" :key="`${event.scope}-${event.id}`">
          <button
            type="button"
            class="event-item"
            :class="{ 'read-only': !canEdit(event) }"
            :data-type="event.type"
            @click="open(event)"
          >
            <span class="event-icon" aria-hidden="true">{{ EVENT_ICONS[event.type] }}</span>
            <span class="event-copy">
              <strong>{{ event.title }}</strong>
              <small>{{ formatEventDate(event.date) }} · {{ relative(event.date) }}</small>
            </span>
          </button>
        </li>
      </ul>
    </aside>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.notes {
  position: relative;
  min-width: 0;
}
.notes-actions {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  display: flex;
  gap: 6px;
}
.save {
  border-color: #356fd1;
  background: #356fd1;
}
.notes :deep(.rich-content) {
  max-width: 760px;
  padding-right: 120px;
}
.notes-editor {
  padding-top: 40px;
}
.notes-editor :deep(.rich-content) {
  min-height: 240px;
  padding: 8px 12px;
  border: 1px solid var(--team-line);
  border-radius: 8px;
}
.empty {
  margin: 8px 0;
  color: var(--muted);
  font-size: 14px;
}
.side {
  min-width: 0;
}
.github-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: #24292f;
  text-decoration: none;
}
.github-card:hover {
  border-color: var(--team-line);
}
.github-card span {
  display: grid;
  min-width: 0;
}
.github-card strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.github-card small {
  color: #6b757e;
  font-size: 12px;
}
.events-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.events-head h2 {
  margin: 0;
  font-size: 15px;
}
.event-list {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.event-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  text-align: left;
}
.event-item:hover {
  background: #f5f7f9;
}
.event-icon {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  margin-top: 12px;
  place-items: center;
  border-radius: 7px;
  background: #e4f3f5;
  font-size: 15px;
}
[data-type='Competition'] .event-icon {
  background: #f1ecfb;
}
[data-type='Other'] .event-icon {
  background: #f0f2f4;
}
.event-copy {
  display: grid;
  min-width: 0;
}
.event-copy strong {
  display: -webkit-box;
  overflow: hidden;
  color: #202124;
  font-size: 14px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.event-copy small {
  color: #6b757e;
  font-size: 12px;
  line-height: 1.5;
}
.event-copy b {
  color: #5b3fa6;
}
.location {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event-pill {
  justify-self: start;
  margin: 2px 0;
  padding: 0 6px;
  border-radius: 9px;
  background: #f0f2f4;
  color: #59636d;
  font-size: 11px;
  font-weight: 650;
}
.text-link {
  display: block;
  margin: 6px 8px 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #59636d;
  font-size: 12px;
}
.text-link:hover {
  color: var(--team-ink);
}
.past {
  margin-top: 6px;
  opacity: 0.8;
}
@media (max-width: 860px) {
  .home {
    grid-template-columns: 1fr;
  }
  .notes :deep(.rich-content) {
    padding-right: 0;
  }
  .notes {
    padding-top: 40px;
  }
}
</style>
