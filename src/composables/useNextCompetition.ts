// The team's next competition (program-wide or the team's own), skipping "If qualified" events.
import { computed } from 'vue'
import { queries, useLiveQuery } from '@/data'
import { daysBetween, todayIso } from '@/model/dates'

export function useNextCompetition(teamId: () => string | null) {
  const programEvents = useLiveQuery(() => teamId() && queries.programEvents())
  const teamEvents = useLiveQuery(() => {
    const id = teamId()
    return id && queries.teamEvents(id)
  })
  return computed(() => {
    const today = todayIso()
    const next = [...programEvents.data.value, ...teamEvents.data.value]
      .filter((event) => event.type === 'Competition' && !event.conditional && event.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    return next ? { ...next, days: daysBetween(today, next.date) } : null
  })
}
