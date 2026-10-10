// The app's data layer: typed refs and queries bound to this deployment's program, live listeners
// (useLiveQuery / useLiveDoc), and the shared writes.
import { auth, db, programId } from '@/firebase'
import { createRefs } from './refs'
import { createQueries } from './queries'
import { createWrites } from './writes'

export const refs = createRefs(db, programId)
export const queries = createQueries(refs)
export const writes = createWrites(refs, () => {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not signed in.')
  return uid
})
export { useLiveDoc, useLiveQuery, type Live } from './live'
export type { NewTask, TaskChanges } from './writes'
