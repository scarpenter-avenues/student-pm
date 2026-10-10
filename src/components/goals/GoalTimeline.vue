<script setup lang="ts">
// A goal's history: set, check-ins (status, what they did, the plan, next steps), coach feedback with the student's
// replies, pauses, edits. `latest` shows just the last check-in and the last feedback, oldest first so feedback reads
// as a reply. The student replies to feedback; adults respond to check-ins and leave feedback. Mentors see only what
// was written while the student was on one of their teams (the query has to say so).
import { computed, nextTick, ref } from 'vue'
import { queries, useLiveQuery, writes } from '@/data'
import { todayIso } from '@/model/dates'
import { ROLE_LABELS, type GoalEvent, type WithId } from '@/model/types'
import type { GoalDoc } from '@/composables/useGoals'
import { useTeam } from '@/composables/useTeamData'
import { useNames } from '@/composables/useNames'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import { formatShortDate, initials } from '@/ui/format'
import GoalStatusPill from './GoalStatusPill.vue'

const props = withDefaults(defineProps<{ goal: GoalDoc; latest?: boolean }>(), { latest: false })

const session = useSession()
const team = useTeam()
const toast = useToast()
const { nameOf, members } = useNames(team)
const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)

const owner = computed(() => props.goal.studentId === session.member?.id)
const adult = computed(() => session.isAdult)
// Mentors may read only events from their own teams; the query must filter for the rules to allow it.
const onlyTeams = computed(() =>
  session.role === 'mentor' ? (session.member?.teamIds ?? []) : undefined,
)
const list = useLiveQuery(() =>
  queries.goalEvents(props.goal.id, onlyTeams.value?.length ? onlyTeams.value : undefined),
)
const events = computed(() => list.data.value)
const shown = computed(() => {
  const visible = events.value.filter((event) => event.type !== 'reply')
  if (!props.latest) return visible
  const lastCheckin = [...visible].reverse().find((event) => event.type === 'checkin')
  const lastFeedback = [...visible].reverse().find((event) => event.type === 'feedback')
  return [lastCheckin, lastFeedback]
    .filter((e): e is WithId<GoalEvent> => !!e)
    .sort((a, b) => a.date.localeCompare(b.date))
})
const historyCount = computed(() => events.value.filter((event) => event.type !== 'reply').length)
const newFeedback = computed(() => {
  if (!owner.value || !props.goal.unreadFeedback) return new Set<string>()
  const feedback = events.value.filter((event) => event.type === 'feedback')
  return new Set(feedback.slice(-props.goal.unreadFeedback).map((event) => event.id))
})
const repliesTo = (id: string) =>
  events.value.filter((event) => event.type === 'reply' && event.replyTo === id)

function roleOf(uid: string) {
  const member = members.value.find((m) => m.id === uid) ?? team.memberById.value.get(uid)
  return member ? ROLE_LABELS[member.role] : ''
}
const teamName = (id: string) => session.teamsById[id]?.name ?? team.team.value?.name ?? ''
const taskTitle = (id: string) => team.tasks.value.find((task) => task.id === id)?.title
function did(event: GoalEvent) {
  const titles = (event.taskIds ?? []).map(taskTitle).filter(Boolean)
  const others = (event.taskIds ?? []).length - titles.length
  return [...titles, ...(others ? [`${others} more ${others === 1 ? 'task' : 'tasks'}`] : [])].join(
    ', ',
  )
}
function nextSteps(event: GoalEvent) {
  return (event.nextSteps ?? [])
    .map((step) =>
      step.sprintId ? `${step.title} (${team.sprintName(step.sprintId)})` : step.title,
    )
    .join('; ')
}

// ---------- replies (the student) ----------
const replyingTo = ref<string | null>(null)
const replyText = ref('')
const replyInput = ref<HTMLInputElement[] | null>(null)
async function startReply(id: string) {
  replyingTo.value = id
  replyText.value = ''
  await nextTick()
  replyInput.value?.[0]?.focus()
}
function sendReply(id: string) {
  if (!replyText.value.trim()) return
  writes.replyToFeedback(props.goal, id, replyText.value.trim(), todayIso()).catch(fail)
  replyingTo.value = null
  toast.show("Reply sent to your team's coaches")
}

// ---------- feedback (adults) ----------
const QUICK = [
  'Nice progress 👏',
  'Great plan',
  "Let's talk at build night",
  'Try the next step you named',
]
const respondingTo = ref<string | 'general' | null>(null)
const feedbackText = ref('')
const feedbackInput = ref<HTMLTextAreaElement[] | HTMLTextAreaElement | null>(null)
async function startFeedback(about: string | 'general') {
  respondingTo.value = about
  feedbackText.value = ''
  await nextTick()
  const el = Array.isArray(feedbackInput.value) ? feedbackInput.value[0] : feedbackInput.value
  el?.focus()
}
function postFeedback() {
  const text = feedbackText.value.trim()
  if (!text) return
  const about = respondingTo.value === 'general' ? null : respondingTo.value
  writes.postFeedback(props.goal, text, todayIso(), about).catch(fail)
  respondingTo.value = null
  toast.show(`Feedback posted for ${nameOf(props.goal.studentId)}`)
}
defineExpose({ startFeedback, historyCount })
</script>

<template>
  <div class="goal-timeline-wrap">
    <ol class="goal-timeline" :class="{ latest }">
      <li v-for="event in shown" :key="event.id" class="goal-event" :class="`e-${event.type}`">
        <time v-if="!latest" :datetime="event.date">{{ formatShortDate(event.date) }}</time>
        <div class="event-body">
          <template v-if="event.type === 'created'"
            >Goal set on {{ teamName(event.teamId) }}</template
          >
          <template v-else-if="event.type === 'edit'">{{ event.change }}</template>
          <template v-else-if="event.type === 'completed'">🎉 Got it! Goal finished.</template>
          <template v-else-if="event.type === 'paused'"
            >⏸ Paused<template v-if="event.reason"> · {{ event.reason }}</template></template
          >
          <template v-else-if="event.type === 'resumed'">▶ Picked back up</template>
          <template v-else-if="event.type === 'changed'"
            >Changed to a new goal<template v-if="event.to">: “{{ event.to }}”</template></template
          >
          <template v-else-if="event.type === 'checkin'">
            <div class="event-top">
              <strong>Check-in</strong>
              <GoalStatusPill v-if="event.status" :status="event.status" />
              <small v-if="latest">{{ formatShortDate(event.date) }}</small>
            </div>
            <p v-if="event.taskIds?.length">Did: {{ did(event) }}</p>
            <p v-if="event.note">{{ event.note }}</p>
            <p v-if="event.planResult">
              If-then plan: {{ event.planResult.toLowerCase()
              }}<template v-if="event.newPlan"> → new plan: “{{ event.newPlan }}”</template>
            </p>
            <p v-if="event.nextSteps?.length">Next: {{ nextSteps(event) }}</p>
            <template v-if="adult && goal.state === 'active'">
              <button
                v-if="respondingTo !== event.id"
                type="button"
                class="text-button respond"
                @click="startFeedback(event.id)"
              >
                Respond
              </button>
              <form v-else class="feedback-composer" @submit.prevent="postFeedback">
                <div class="quick">
                  <button
                    v-for="text in QUICK"
                    :key="text"
                    type="button"
                    class="quick-chip"
                    @click="feedbackText = text"
                  >
                    {{ text }}
                  </button>
                </div>
                <textarea
                  ref="feedbackInput"
                  v-model="feedbackText"
                  rows="2"
                  maxlength="400"
                  placeholder="Respond to this check-in…"
                />
                <p class="goal-more">Visible to the student and every coach on the team.</p>
                <div class="goal-modal-actions">
                  <button type="button" class="goal-button" @click="respondingTo = null">
                    Cancel
                  </button>
                  <button type="submit" class="goal-button primary">Post feedback</button>
                </div>
              </form>
            </template>
          </template>
          <template v-else-if="event.type === 'feedback'">
            <div class="event-top">
              <span class="avatar">{{ initials(nameOf(event.authorId)) }}</span>
              <strong>{{ nameOf(event.authorId) }}</strong>
              <small>
                {{ roleOf(event.authorId)
                }}<template v-if="event.teamId !== goal.teamId">
                  · {{ teamName(event.teamId) }}</template
                ><template v-if="latest"> · {{ formatShortDate(event.date) }}</template>
              </small>
              <span v-if="newFeedback.has(event.id)" class="new-badge">New</span>
            </div>
            <p>{{ event.text }}</p>
            <p v-for="reply in repliesTo(event.id)" :key="reply.id" class="reply">
              {{ nameOf(reply.authorId) }}: {{ reply.text }}
            </p>
            <template v-if="owner && goal.state === 'active'">
              <form
                v-if="replyingTo === event.id"
                class="reply-form"
                @submit.prevent="sendReply(event.id)"
              >
                <input
                  ref="replyInput"
                  v-model="replyText"
                  maxlength="200"
                  placeholder="Reply to your coaches…"
                  :aria-label="`Reply to ${nameOf(event.authorId)}`"
                  @keydown.esc.stop="replyingTo = null"
                />
                <button type="submit">Reply</button>
              </form>
              <button
                v-else
                type="button"
                class="text-button respond"
                @click="startReply(event.id)"
              >
                Reply
              </button>
            </template>
          </template>
        </div>
      </li>
    </ol>
    <p v-if="!shown.length && !list.loading.value" class="goal-more">No updates yet.</p>
    <form
      v-if="respondingTo === 'general'"
      class="feedback-composer"
      @submit.prevent="postFeedback"
    >
      <div class="quick">
        <button
          v-for="text in QUICK"
          :key="text"
          type="button"
          class="quick-chip"
          @click="feedbackText = text"
        >
          {{ text }}
        </button>
      </div>
      <textarea
        ref="feedbackInput"
        v-model="feedbackText"
        rows="2"
        maxlength="400"
        placeholder="Leave feedback on this goal…"
      />
      <p class="goal-more">Visible to the student and every coach on the team.</p>
      <div class="goal-modal-actions">
        <button type="button" class="goal-button" @click="respondingTo = null">Cancel</button>
        <button type="submit" class="goal-button primary">Post feedback</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.goal-timeline-wrap {
  margin-top: 14px;
}
.goal-timeline {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.goal-event {
  display: grid;
  grid-template-columns: 54px 1fr;
  gap: 10px;
  padding: 8px 0;
  border-top: 1px solid #eef0f3;
  font-size: 13px;
}
.latest .goal-event {
  grid-template-columns: 1fr;
  padding: 4px 0;
  border-top: 0;
}
time {
  padding-top: 2px;
  color: #8a949c;
  font-size: 12px;
}
.event-body {
  min-width: 0;
  color: #3f474e;
}
.event-body p {
  margin: 3px 0 0;
}
.event-top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
}
.event-top small {
  color: #8a949c;
  font-size: 12px;
}
.avatar {
  display: inline-grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 50%;
  background: #e2ece6;
  color: #27654f;
  font-size: 8px;
  font-weight: 800;
}
.new-badge {
  padding: 0 6px;
  border-radius: 8px;
  background: #d9534f;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.reply {
  padding-left: 10px;
  border-left: 2px solid var(--team-line);
  color: #4b5560;
}
.respond {
  margin-top: 4px;
  padding: 0;
  font-size: 12px;
}
.reply-form {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.reply-form input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 9px;
  border: 1px solid #d5dce5;
  border-radius: 6px;
  font-size: 13px;
}
.reply-form button {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
}
.feedback-composer {
  display: grid;
  gap: 8px;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--team-line);
  border-radius: 8px;
  background: #fff;
}
.feedback-composer textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d5dce5;
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  resize: vertical;
}
.feedback-composer .goal-modal-actions {
  margin-top: 0;
}
.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.quick-chip {
  padding: 3px 9px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  color: #4d5962;
  font-size: 12px;
}
.quick-chip:hover {
  border-color: var(--team-line);
  background: var(--team-softer);
}
</style>
