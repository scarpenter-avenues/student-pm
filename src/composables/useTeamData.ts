// Everything a team's pages share, live: the team, its sprints this season, its unarchived tasks (one listener for
// Board, List, Timeline, Planning, and My Tasks; a team has dozens), and its roster.
//
// AppShell creates one for the team in the URL and provides it (useTeam()); the task panel and the Coaches' Dashboard
// create their own for other teams. Firestore shares identical listeners, so that doesn't double the reads.
import { computed, inject, provide, type InjectionKey } from 'vue'
import { queries, refs, useLiveDoc, useLiveQuery } from '@/data'
import { todayIso } from '@/model/dates'
import { byRank } from '@/model/rank'
import { ADULT_ROLES, type Member, type Sprint, type Task, type WithId } from '@/model/types'
import { useSession } from '@/stores/session'
import type { Person } from '@/components/ui/AssigneePicker.vue'

export function createTeamData(teamIdOf: () => string | null) {
  const session = useSession()
  const teamId = computed(teamIdOf)
  const seasonId = computed(() => session.program?.currentSeasonId ?? null)

  const teamDoc = useLiveDoc(() => teamId.value && refs.team(teamId.value))
  const sprintList = useLiveQuery(
    () => teamId.value && seasonId.value && queries.sprints(teamId.value, seasonId.value),
  )
  const taskList = useLiveQuery(() => teamId.value && queries.planningTasks(teamId.value))
  const memberList = useLiveQuery(() => teamId.value && queries.teamMembers(teamId.value))
  const coachList = useLiveQuery(() => teamId.value && queries.coaches())

  const team = computed(() => teamDoc.data.value)
  const subteams = computed(() => team.value?.subteams ?? [])
  const sprints = computed(() => [...sprintList.data.value].sort((a, b) => a.index - b.index))
  const tasks = computed(() => [...taskList.data.value].sort(byRank))

  /** The sprint today falls in; before the first, the first; after the last, the last. */
  const currentSprint = computed<WithId<Sprint> | null>(() => {
    const today = todayIso()
    const list = sprints.value
    return (
      list.find((sprint) => today >= sprint.start && today <= sprint.end) ??
      (list[0] && today < list[0].start ? list[0] : (list.at(-1) ?? null))
    )
  })
  const sprintById = computed(() => new Map(sprints.value.map((sprint) => [sprint.id, sprint])))
  const sprintName = (id: string | null) =>
    id === null ? 'Backlog' : (sprintById.value.get(id)?.name ?? 'Earlier sprint')

  /** The team's members (students, leads, mentors), then program coaches. */
  const members = computed<WithId<Member>[]>(() => {
    const onTeam = [...memberList.data.value].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    )
    const coaches = coachList.data.value.filter((coach) => !onTeam.some((m) => m.id === coach.id))
    return [...onTeam, ...coaches]
  })
  const memberById = computed(() => new Map(members.value.map((member) => [member.id, member])))
  const nameOf = (uid: string) => memberById.value.get(uid)?.displayName ?? 'Former member'
  /** Who tasks can be assigned to: the team's own roster (students and leads first, then mentors). */
  const people = computed<Person[]>(() =>
    [...memberList.data.value]
      .sort(
        (a, b) =>
          Number(ADULT_ROLES.includes(a.role)) - Number(ADULT_ROLES.includes(b.role)) ||
          a.displayName.localeCompare(b.displayName),
      )
      .map(({ id, displayName }) => ({ id, displayName })),
  )
  /** Subteams someone works on, on this team. */
  const subteamsOf = (uid: string) => memberById.value.get(uid)?.subteams[teamId.value ?? ''] ?? []

  const role = computed(() => session.member?.role ?? null)
  const can = computed(() => {
    const onTeam =
      !!teamId.value && (session.isCoach || !!session.member?.teamIds.includes(teamId.value))
    const adult = onTeam && session.isAdult
    return {
      /** Leads, mentors, coaches: mark objectives met anywhere, edit them in Planning, edit sprint dates. */
      plan: onTeam && (role.value === 'lead' || adult),
      /** Leads, mentors, coaches: the team's name, number, color, subteams, and GitHub settings. */
      editTeam: onTeam && (role.value === 'lead' || adult),
      /** Mentors and coaches: members (adding people by email, roles, removing); hard-delete archived tasks. */
      manage: adult,
      /** Leads also change subteam assignments. */
      assignSubteams: onTeam && (role.value === 'lead' || adult),
    }
  })

  const loading = computed(
    () => taskList.loading.value || sprintList.loading.value || teamDoc.loading.value,
  )

  function tasksIn(sprintId: string | null): WithId<Task>[] {
    return tasks.value.filter((task) => task.sprintId === sprintId)
  }

  return {
    teamId,
    team,
    subteams,
    sprints,
    currentSprint,
    sprintById,
    sprintName,
    tasks,
    tasksIn,
    members,
    memberById,
    nameOf,
    people,
    subteamsOf,
    can,
    loading,
    taskError: taskList.error,
  }
}

export type TeamData = ReturnType<typeof createTeamData>

const KEY: InjectionKey<TeamData> = Symbol('team')

export function provideTeam(data: TeamData) {
  provide(KEY, data)
}

/** The team in the URL (provided by AppShell). */
export function useTeam(): TeamData {
  const data = inject(KEY)
  if (!data) throw new Error('useTeam() needs AppShell')
  return data
}
