// The team's next competition (program-wide or the team's own), skipping "If qualified" events.
import { computed } from 'vue'
import { daysBetween, todayIso } from '@/model/dates'
import { useEvents } from './useEvents'

export function useNextCompetition(teamId: () => string | null) {
  const { events } = useEvents(teamId)
  return computed(() => {
    const today = todayIso()
    const next = events.value.find(
      (event) => event.type === 'Competition' && !event.conditional && event.date >= today,
    )
    return next ? { ...next, days: daysBetween(today, next.date) } : null
  })
}
