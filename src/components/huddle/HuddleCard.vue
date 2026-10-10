<script setup lang="ts">
// One huddle in the feed: open (where things stand, the timed plan, heads-ups) or a one-line summary; quick notes
// are slim cards. "Seen by N of M" counts coaches and mentors.
import { computed } from 'vue'
import { daysBetween, todayIso } from '@/model/dates'
import type { Huddle, WithId } from '@/model/types'
import { formatEventDate } from '@/ui/format'
import RichText from '@/components/ui/RichText.vue'
import TeamChip from '@/components/ui/TeamChip.vue'

const props = defineProps<{
  huddle: WithId<Huddle>
  open: boolean
  authorName: string
  seenBy: number
  adults: number
  teams: Readonly<Record<string, { name: string; color: string }>>
  canDelete: boolean
}>()
const emit = defineEmits<{ toggle: []; delete: [] }>()

function dayLabel(iso: string) {
  const offset = daysBetween(iso, todayIso())
  return `${formatEventDate(iso)}${offset === 0 ? ' · Today' : offset === 1 ? ' · Yesterday' : ''}`
}
const posted = computed(() =>
  props.huddle.postedAt
    ?.toDate()
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
)
const meta = computed(
  () => `${props.authorName} · ${posted.value} · Seen by ${props.seenBy} of ${props.adults}`,
)
function time(hhmm: string) {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}
const summary = computed(() => props.huddle.status ?? props.huddle.text ?? '')
</script>

<template>
  <article v-if="huddle.kind === 'note'" class="card note">
    <header>
      <strong>Quick note · {{ dayLabel(huddle.date) }}</strong>
      <small>{{ meta }}</small>
    </header>
    <RichText v-if="huddle.textHtml" :html="huddle.textHtml" label="Quick note" />
    <p v-else>{{ huddle.text }}</p>
    <button v-if="canDelete" type="button" class="delete" @click="emit('delete')">Delete</button>
  </article>

  <article v-else-if="open" class="card huddle">
    <header>
      <h3>{{ dayLabel(huddle.date) }}</h3>
      <small>{{ meta }}</small>
    </header>
    <template v-if="huddle.statusHtml || huddle.status">
      <h4>Where things stand</h4>
      <RichText v-if="huddle.statusHtml" :html="huddle.statusHtml" label="Where things stand" />
      <p v-else>{{ huddle.status }}</p>
    </template>
    <template v-if="huddle.plan?.length">
      <h4>Plan for the session</h4>
      <ul class="plan">
        <li v-for="(row, i) in huddle.plan" :key="i">
          <span class="time">{{ time(row.time) }}</span>
          <span class="what">{{ row.text }}</span>
          <span class="who">
            <span v-if="row.audience.includes('adults')" class="adults">Coaches &amp; mentors</span>
            <template v-for="id in row.audience" :key="id">
              <TeamChip v-if="teams[id]" :team="teams[id]!" />
            </template>
          </span>
        </li>
      </ul>
    </template>
    <template v-if="huddle.notesHtml || huddle.notes">
      <h4>Heads-ups and needs</h4>
      <RichText v-if="huddle.notesHtml" :html="huddle.notesHtml" label="Heads-ups and needs" />
      <p v-else>{{ huddle.notes }}</p>
    </template>
    <div class="card-foot">
      <button type="button" class="collapse" @click="emit('toggle')">Collapse</button>
      <button v-if="canDelete" type="button" class="delete" @click="emit('delete')">Delete</button>
    </div>
  </article>

  <button
    v-else
    type="button"
    class="card summary"
    :aria-label="`Open the huddle for ${dayLabel(huddle.date)}`"
    @click="emit('toggle')"
  >
    <strong>{{ dayLabel(huddle.date) }}</strong>
    <small>{{ authorName }}</small>
    <span class="summary-text">{{ summary }}</span>
  </button>
</template>

<style scoped>
.card {
  position: relative;
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: #fff;
  text-align: left;
}
header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 12px;
}
header small,
.summary small {
  color: #8a949c;
  font-size: 12px;
}
h3 {
  margin: 0;
  font-size: 16px;
}
h4 {
  margin: 6px 0 0;
  color: #59636d;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
p {
  margin: 0;
  color: #2c343b;
  font-size: 14px;
  line-height: 1.55;
}
.card :deep(.rich-content) {
  min-height: 0;
  color: #2c343b;
  font-size: 14px;
  line-height: 1.55;
}
.card :deep(.rich-content p) {
  margin: 0.15em 0;
}
.note {
  padding: 10px 16px;
  border-left: 3px solid #9db8e8;
}
.plan {
  margin: 0;
  padding: 0;
  list-style: none;
}
.plan li {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  border-bottom: 1px solid #edf0f2;
  font-size: 14px;
}
.plan li:last-child {
  border-bottom: 0;
}
.time {
  color: #59636d;
  font-size: 13px;
}
.who {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}
.adults {
  padding: 1px 7px;
  border-radius: 10px;
  background: #eef0f2;
  color: #3f474e;
  font-size: 11px;
  font-weight: 650;
}
.card-foot {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.collapse,
.delete {
  padding: 0;
  border: 0;
  background: transparent;
  color: #8a949c;
  font-size: 12px;
}
.note .delete {
  position: absolute;
  right: 16px;
  bottom: 8px;
}
.delete:hover {
  color: #a43d34;
}
.summary {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 9px 16px;
  cursor: pointer;
}
.summary:hover {
  border-color: var(--team-line);
}
.summary small {
  flex: 0 0 auto;
  white-space: nowrap;
}
.summary strong {
  flex: 0 0 auto;
  font-size: 13px;
}
.summary-text {
  min-width: 0;
  overflow: hidden;
  color: #59636d;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
