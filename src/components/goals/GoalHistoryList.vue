<script setup lang="ts">
// Goal history, newest first, grouped by season. Goals follow students across teams.
import { computed, ref } from 'vue'
import { localIso } from '@/model/dates'
import { goalStatement } from '@/model/types'
import { goalCreated, useSeasons, type GoalDoc } from '@/composables/useGoals'
import { useSession } from '@/stores/session'
import { formatShortDate, plural } from '@/ui/format'
import GoalTimeline from './GoalTimeline.vue'

const props = defineProps<{ goals: readonly GoalDoc[]; title: string }>()
const session = useSession()
const seasons = useSeasons()
const groups = computed(() => {
  const list: { season: string; goals: GoalDoc[] }[] = []
  props.goals.forEach((goal) => {
    const name = `${seasons.value.get(goal.seasonId)?.name ?? goal.seasonId} season`
    const group = list.at(-1)
    if (group?.season === name) group.goals.push(goal)
    else list.push({ season: name, goals: [goal] })
  })
  return list
})
const open = ref<Set<string>>(new Set())
function toggle(id: string) {
  const next = new Set(open.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  open.value = next
}
const outcome: Record<GoalDoc['state'], string> = {
  active: 'In progress',
  paused: 'Paused',
  done: 'Got it',
  changed: 'Changed',
}
function span(goal: GoalDoc) {
  const start = formatShortDate(goalCreated(goal))
  const end = goal.finishedAt
    ? formatShortDate(localIso(goal.finishedAt.toDate()))
    : goal.state === 'paused'
      ? 'paused'
      : 'now'
  return `${session.teamsById[goal.teamId]?.name ?? ''} · ${start} – ${end}`
}
</script>

<template>
  <section class="goal-history">
    <div class="goal-section-head">
      <h3>{{ title }}</h3>
    </div>
    <p v-if="!goals.length" class="goal-more">No past goals yet.</p>
    <template v-for="group in groups" :key="group.season">
      <p class="season-label">{{ group.season }}</p>
      <article v-for="goal in group.goals" :key="goal.id" class="entry" :class="`h-${goal.state}`">
        <div class="entry-top">
          <strong>{{ goalStatement(goal.wish) }}</strong>
          <span :class="goal.state === 'done' ? 'goal-status s-5' : 'goal-status s-1'">
            {{
              goal.state === 'active' ? `${outcome.active} · ${goal.status}` : outcome[goal.state]
            }}
          </span>
        </div>
        <p class="meta">
          {{ span(goal)
          }}<template v-if="goal.lastCheckinAt">
            · last check-in {{ formatShortDate(goal.lastCheckinAt) }}</template
          >
        </p>
        <dl
          v-if="
            goal.reflection &&
            (goal.reflection.helped || goal.reflection.different || goal.reflection.next)
          "
          class="goal-private"
        >
          <template v-if="goal.reflection.helped"
            ><dt>What helped most</dt>
            <dd>{{ goal.reflection.helped }}</dd></template
          >
          <template v-if="goal.reflection.different"
            ><dt>What I'd do differently</dt>
            <dd>{{ goal.reflection.different }}</dd></template
          >
          <template v-if="goal.reflection.next"
            ><dt>What's next</dt>
            <dd>{{ goal.reflection.next }}</dd></template
          >
        </dl>
        <button type="button" class="text-button toggle" @click="toggle(goal.id)">
          {{ open.has(goal.id) ? 'Hide timeline' : 'Show timeline' }}
        </button>
        <GoalTimeline v-if="open.has(goal.id)" :goal="goal" />
      </article>
    </template>
    <p v-if="goals.length" class="goal-more">{{ plural(goals.length, 'goal') }}</p>
  </section>
</template>

<style scoped>
.entry {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--team-line);
  border-radius: 8px;
  background: #fff;
}
.entry.h-done {
  border-left-color: #8fd0a9;
}
.entry.h-paused,
.entry.h-changed {
  border-left-color: #cfd6dd;
}
.entry-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.entry-top strong {
  font-size: 15px;
}
.meta {
  margin: 0;
  color: #737d86;
  font-size: 12px;
}
.toggle {
  justify-self: start;
  padding: 2px 0;
  font-size: 12px;
}
</style>
