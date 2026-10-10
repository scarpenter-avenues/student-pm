<script setup lang="ts">
// Coaches' Dashboard → Goals: every team's students and their active goals, with what each needs from a coach.
// "Needs attention" (the default) shows only students who need something; "Everyone" shows all. A row opens the
// student's goals for review and feedback (?student=uid).
import { computed, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { queries, useLiveQuery } from '@/data'
import { ADULT_ROLES } from '@/model/types'
import { useSession } from '@/stores/session'
import { plural } from '@/ui/format'
import SelectButton from '@/components/ui/SelectButton.vue'
import StudentGoalDetail from '@/components/goals/StudentGoalDetail.vue'
import TeamGoalGroup from '@/components/dashboard/TeamGoalGroup.vue'
import { DASHBOARD_GOALS, createDashboardGoals } from '@/components/dashboard/dashboardGoals'

const session = useSession()
const route = useRoute()
const router = useRouter()
const page = createDashboardGoals()
provide(DASHBOARD_GOALS, page)

const scope = ref<'attention' | 'everyone'>('attention')
const teamFilter = ref('all')
const search = ref('')
const members = useLiveQuery(() => queries.allMembers())
const teamIds = computed(() => session.teams.map((team) => team.id))
// `in` takes up to 30 values: one query per 30 teams.
const chunks = computed(() =>
  Array.from({ length: Math.ceil(teamIds.value.length / 30) }, (_, i) =>
    teamIds.value.slice(i * 30, i * 30 + 30),
  ),
)
const first = useLiveQuery(() => !!chunks.value[0]?.length && queries.teamGoals(chunks.value[0]))
const second = useLiveQuery(() => !!chunks.value[1]?.length && queries.teamGoals(chunks.value[1]))
const goals = computed(() => [...first.data.value, ...second.data.value])
const teams = computed(() =>
  session.teams.filter((team) => teamFilter.value === 'all' || team.id === teamFilter.value),
)
// Built once per change (not per render), so the team groups get stable lists.
const studentsByTeam = computed(() => {
  const map = new Map<string, typeof members.data.value>()
  teamIds.value.forEach((id) =>
    map.set(
      id,
      members.data.value
        .filter((member) => member.teamIds.includes(id) && !ADULT_ROLES.includes(member.role))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    ),
  )
  return map
})
const goalsByTeam = computed(() => {
  const map = new Map<string, typeof goals.value>()
  goals.value.forEach((goal) => map.set(goal.teamId, [...(map.get(goal.teamId) ?? []), goal]))
  return map
})
const NONE: never[] = []

const student = computed(() =>
  typeof route.query.student === 'string' ? route.query.student : null,
)
function open(studentId: string | null) {
  void router.push({
    name: 'dashboard',
    params: { tab: 'goals' },
    query: studentId ? { student: studentId } : {},
  })
}
</script>

<template>
  <section class="dashboard-goals">
    <StudentGoalDetail
      v-if="student"
      :key="student"
      :student-id="student"
      back-label="← Back to all goals"
      @back="open(null)"
    />
    <template v-else>
      <div class="head">
        <div>
          <h2>Goals</h2>
          <p>
            {{ page.needing.value }} of {{ plural(page.students.value, 'student') }} need attention
          </p>
        </div>
        <div class="filters">
          <div class="scope" role="group" aria-label="Show">
            <button
              type="button"
              :aria-pressed="scope === 'attention'"
              @click="scope = 'attention'"
            >
              Needs attention
            </button>
            <button type="button" :aria-pressed="scope === 'everyone'" @click="scope = 'everyone'">
              Everyone
            </button>
          </div>
          <SelectButton
            v-model="teamFilter"
            class="filter"
            label="Team"
            :options="[
              { value: 'all', label: 'All teams' },
              ...session.teams.map((t) => ({ value: t.id, label: t.name })),
            ]"
          >
            <template #value="{ value }">{{
              value === 'all' ? 'All teams' : session.teamsById[value as string]?.name
            }}</template>
          </SelectButton>
          <label class="search">
            <span aria-hidden="true">⌕</span>
            <input
              v-model="search"
              type="search"
              placeholder="Find a student or goal"
              aria-label="Find a student or goal"
            />
          </label>
        </div>
      </div>
      <div class="table-wrap">
        <table class="task-table dense goal-table">
          <colgroup>
            <col style="width: 200px" />
            <col />
            <col style="width: 130px" />
            <col style="width: 120px" />
            <col style="width: 260px" />
          </colgroup>
          <thead>
            <tr>
              <th>Student</th>
              <th>Goal</th>
              <th>Status</th>
              <th>Last check-in</th>
              <th>Needs</th>
            </tr>
          </thead>
          <TeamGoalGroup
            v-for="team in teams"
            :key="team.id"
            :team="team"
            :students="studentsByTeam.get(team.id) ?? NONE"
            :goals="goalsByTeam.get(team.id) ?? NONE"
            :focused="scope === 'attention'"
            :search="search"
            @open="open"
          />
        </table>
        <p v-if="scope === 'attention' && !page.needing.value && !search" class="empty">
          Nobody needs you right now 🎉
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}
h2 {
  margin: 0;
  font-size: 20px;
}
.head p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.scope {
  display: flex;
  padding: 3px;
  border-radius: 8px;
  background: #f0f2f4;
}
.scope button {
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #59636d;
  font-size: 13px;
  font-weight: 600;
}
.scope button[aria-pressed='true'] {
  background: #fff;
  color: #202124;
  box-shadow: 0 1px 2px rgba(32, 45, 61, 0.12);
}
.filter {
  min-width: 128px;
  min-height: 36px;
  border-color: var(--line);
}
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: #8a949c;
}
.search input {
  width: 150px;
  border: 0;
  outline: none;
  font-size: 13px;
}
.table-wrap {
  overflow-x: auto;
}
.goal-table {
  min-width: 860px;
}
.empty {
  margin: 16px 6px;
  color: var(--muted);
  font-size: 14px;
}
</style>
