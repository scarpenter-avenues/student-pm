// A team's calendar: program-wide events plus the team's own, by date. `team` marks the team's own.
import { computed } from 'vue'
import { queries, useLiveQuery } from '@/data'
import type { CalendarEvent, WithId } from '@/model/types'

export type TeamEvent = WithId<CalendarEvent> & { scope: 'program' | 'team' }

export const EVENT_ICONS: Record<CalendarEvent['type'], string> = {
  Competition: '🏆',
  'Work session': '🔧',
  Other: '📌',
}

export function useEvents(teamId: () => string | null) {
  const programEvents = useLiveQuery(() => teamId() && queries.programEvents())
  const teamEvents = useLiveQuery(() => {
    const id = teamId()
    return id && queries.teamEvents(id)
  })
  const events = computed<TeamEvent[]>(() =>
    [
      ...programEvents.data.value.map((event) => ({ ...event, scope: 'program' as const })),
      ...teamEvents.data.value.map((event) => ({ ...event, scope: 'team' as const })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),
  )
  return {
    events,
    loading: computed(() => programEvents.loading.value || teamEvents.loading.value),
  }
}
