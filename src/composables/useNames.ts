// Display names by uid. Program coaches load the whole program's roster (their pages span teams); everyone else
// uses their team's roster plus program coaches.
import { computed } from 'vue'
import { queries, useLiveQuery } from '@/data'
import { useSession } from '@/stores/session'
import type { TeamData } from './useTeamData'

export function useNames(team?: TeamData) {
  const session = useSession()
  const everyone = useLiveQuery(() => session.isCoach && queries.allMembers())
  const byId = computed(() => new Map(everyone.data.value.map((member) => [member.id, member])))
  const nameOf = (uid: string) =>
    byId.value.get(uid)?.displayName ??
    (uid === session.member?.id
      ? session.member.displayName
      : (team?.nameOf(uid) ?? 'Former member'))
  return { nameOf, members: computed(() => everyone.data.value) }
}
