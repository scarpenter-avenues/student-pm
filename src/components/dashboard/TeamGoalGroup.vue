<script setup lang="ts">
// One team on the Coaches' Dashboard → Goals: a row per active goal (the student's name on the first), or one row
// for a student without one. Students who need something come first. Needs = up to 2 chips, then "+N".
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { queries, useLiveQuery } from '@/data'
import { todayIso } from '@/model/dates'
import { checkinWindow, coachNeeds, goalFlags, needsCoach, type Flag } from '@/model/goals'
import { goalStatement, type Member, type Team, type WithId } from '@/model/types'
import { goalLike, type GoalDoc } from '@/composables/useGoals'
import { formatShortDate, initials } from '@/ui/format'
import TeamBadge from '@/components/TeamBadge.vue'
import GoalStatusPill from '@/components/goals/GoalStatusPill.vue'
import { DASHBOARD_GOALS, type DashboardGoals } from './dashboardGoals'

const props = defineProps<{
  team: WithId<Team>
  students: readonly WithId<Member>[]
  goals: readonly GoalDoc[]
  focused: boolean
  search: string
}>()
const emit = defineEmits<{ open: [studentId: string] }>()
const page = inject(DASHBOARD_GOALS) as DashboardGoals

const seasonId = computed(() => props.team.seasonIds.at(-1) ?? '')
const sprintList = useLiveQuery(
  () => seasonId.value && queries.sprints(props.team.id, seasonId.value),
)
const window = computed(() =>
  checkinWindow(
    [...sprintList.data.value].sort((a, b) => a.index - b.index),
    todayIso(),
  ),
)

interface Row {
  student: WithId<Member>
  goal: GoalDoc | null
  pausedGoal: GoalDoc | null
  flags: Flag[]
}
const allRows = computed<Row[]>(() =>
  props.students.flatMap((student): Row[] => {
    const own = props.goals.filter((goal) => goal.studentId === student.id)
    const active = own.filter((goal) => goal.state === 'active')
    const paused = own.filter((goal) => goal.state === 'paused')
    const recentlyDone = own.some(
      (goal) =>
        goal.state === 'done' &&
        goal.finishedAt &&
        Date.now() - goal.finishedAt.toMillis() < 14 * 86_400_000,
    )
    if (!active.length)
      return [
        {
          student,
          goal: null,
          pausedGoal: paused[0] ?? null,
          flags: goalFlags(null, null, todayIso(), { paused: paused.length, recentlyDone }),
        },
      ]
    return active.map((goal) => ({
      student,
      goal,
      pausedGoal: null,
      flags: goalFlags(goalLike(goal), window.value, todayIso()),
    }))
  }),
)
const needing = computed(
  () =>
    new Set(
      allRows.value
        .filter((row) => needsCoach(row.flags, row.goal?.status ?? null))
        .map((row) => row.student.id),
    ),
)
const rows = computed(() => {
  const query = props.search.trim().toLowerCase()
  const ordered = [
    ...allRows.value.filter((row) => needing.value.has(row.student.id)),
    ...allRows.value.filter((row) => !needing.value.has(row.student.id)),
  ]
  return ordered.filter(
    (row) =>
      (!props.focused || needsCoach(row.flags, row.goal?.status ?? null)) &&
      (!query ||
        `${row.student.displayName} ${row.goal ? goalStatement(row.goal.wish) : ''}`
          .toLowerCase()
          .includes(query)),
  )
})
page.register(props.team.id, {
  needing: () => needing.value.size,
  students: () => props.students.length,
})
onBeforeUnmount(() => page.unregister(props.team.id))
const hidden = computed(() => !rows.value.length && (props.focused || !!props.search.trim()))

const open = ref(!page.collapsed.value.has(props.team.id))
watch(open, (isOpen) => page.setCollapsed(props.team.id, !isOpen))
function relative(iso: string) {
  const days = Math.round((Date.parse(todayIso()) - Date.parse(iso)) / 86_400_000)
  return days === 0
    ? 'today'
    : days === 1
      ? 'yesterday'
      : days < 7
        ? `${days} days ago`
        : formatShortDate(iso)
}
</script>

<template>
  <tbody v-if="!hidden" class="team-group">
    <tr class="group-row">
      <td colspan="5">
        <div class="group-head">
          <button type="button" class="toggle" :aria-expanded="open" @click="open = !open">
            <span class="arrow" aria-hidden="true">▾</span>
            <TeamBadge :team="team" size="small" class="badge" />
            <strong>{{ team.name }}</strong>
          </button>
          <small>{{
            needing.size ? `${needing.size} need${needing.size === 1 ? 's' : ''} you` : ''
          }}</small>
          <RouterLink
            class="open-team"
            :to="{ name: 'team', params: { teamId: team.id, tab: 'goals' } }"
            >Open team →</RouterLink
          >
        </div>
      </td>
    </tr>
    <template v-if="open">
      <tr
        v-for="(row, i) in rows"
        :key="`${row.student.id}-${row.goal?.id ?? 'none'}`"
        class="goal-row"
        @click="emit('open', row.student.id)"
      >
        <td>
          <span v-if="rows[i - 1]?.student.id !== row.student.id" class="who">
            <span class="avatar">{{ initials(row.student.displayName) }}</span>
            <button type="button" class="name" @click.stop="emit('open', row.student.id)">
              {{ row.student.displayName }}
            </button>
          </span>
        </td>
        <td :class="row.goal ? 'goal-cell' : 'muted-cell'">
          {{
            row.goal
              ? goalStatement(row.goal.wish)
              : row.pausedGoal
                ? `Paused: ${goalStatement(row.pausedGoal.wish)}`
                : 'No goal yet'
          }}
        </td>
        <td><GoalStatusPill v-if="row.goal" :status="row.goal.status" /></td>
        <td>
          {{
            row.goal ? (row.goal.lastCheckinAt ? relative(row.goal.lastCheckinAt) : 'None yet') : ''
          }}
        </td>
        <td class="needs">
          <span
            v-for="[text, tone] in coachNeeds(row.flags).slice(0, 2)"
            :key="text"
            :class="`review-flag ${tone}`"
            >{{ text }}</span
          >
          <small
            v-if="coachNeeds(row.flags).length > 2"
            :title="
              coachNeeds(row.flags)
                .slice(2)
                .map(([t]) => t)
                .join(', ')
            "
          >
            +{{ coachNeeds(row.flags).length - 2 }}
          </small>
        </td>
      </tr>
    </template>
  </tbody>
</template>

<style scoped>
.group-row td {
  padding: 22px 6px 6px !important;
  border-bottom: 1px solid var(--line);
}
.team-group:first-of-type .group-row td {
  padding-top: 8px !important;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #202124;
  font-size: 14px;
}
.arrow {
  color: #737d86;
  font-size: 10px;
  transition: transform 0.15s;
}
.toggle[aria-expanded='false'] .arrow {
  transform: rotate(-90deg);
}
.badge {
  width: 46px;
  height: 20px;
}
small {
  margin-left: auto;
  color: #8a949c;
  font-size: 12px;
}
.open-team {
  color: #59636d;
  font-size: 12px;
  font-weight: 650;
  text-decoration: none;
}
.goal-row {
  cursor: pointer;
}
.who {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 24px;
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
.name,
.goal-cell {
  color: #202124;
  font-size: 13px;
  font-weight: 600;
}
.name {
  padding: 0;
  border: 0;
  background: transparent;
}
.name:hover {
  color: #2864c7;
}
.muted-cell {
  color: #9aa3aa;
}
.needs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.needs small {
  margin-left: 2px;
}
</style>
