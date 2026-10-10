// Unread announcements and huddles for the signed-in person, live. Used by the top bar's counts (and later the
// announcement banner and the huddle pop-up). Firestore shares one listener between identical queries, so calling
// these from several components doesn't add reads.
import { computed } from 'vue'
import { queries, refs, useLiveDoc, useLiveQuery, writes } from '@/data'
import { useSession } from '@/stores/session'

/** A team's feed (its own and program-wide posts), or every post on the Coaches' Dashboard (teamId "all"). */
export function useAnnouncements(teamId: () => string | null) {
  const session = useSession()
  const feed = useLiveQuery(() => {
    const id = teamId()
    if (!id || !session.member) return null
    return id === 'all'
      ? session.isCoach && queries.allAnnouncements()
      : queries.teamAnnouncements(id)
  })
  const state = useLiveDoc(() => session.member && refs.userState(session.member.id))
  const unread = computed(() => {
    const read = state.data.value?.announcementsRead ?? {}
    return feed.data.value.filter((item) => item.authorId !== session.member?.id && !read[item.id])
  })
  return {
    announcements: feed.data,
    unread,
    markRead: (ids = unread.value.map((item) => item.id)) => writes.markAnnouncementsRead(ids),
  }
}

const pending = new Set<string>()

/** Adults only: huddles someone else posted that you haven't seen. */
export function useHuddles() {
  const session = useSession()
  const feed = useLiveQuery(() => session.isAdult && queries.huddles())
  const unread = computed(() => {
    const uid = session.member?.id
    return feed.data.value.filter(
      (item) => item.authorId !== uid && !item.readBy.includes(uid ?? ''),
    )
  })
  return {
    huddles: feed.data,
    unread,
    markRead: (ids = unread.value.map((item) => item.id)) => {
      // Skip ones already on their way, so two quick calls don't send the same write twice.
      const fresh = ids.filter((id) => !pending.has(id))
      fresh.forEach((id) => pending.add(id))
      return writes.markHuddlesRead(fresh).finally(() => fresh.forEach((id) => pending.delete(id)))
    },
  }
}
