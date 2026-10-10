// The app's data layer: typed refs and queries bound to this deployment's program, live listeners
// (useLiveQuery / useLiveDoc), and the shared writes.
import { auth, db, programId } from '@/firebase'
import { createRefs } from './refs'
import { createQueries } from './queries'
import { createWrites } from './writes'
import { createAdmin } from './admin'

export const refs = createRefs(db, programId)
export const queries = createQueries(refs)
const currentUid = () => {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Not signed in.')
  return uid
}
export const writes = createWrites(refs, currentUid)
/** Program-wide changes (program coaches). */
export const admin = createAdmin(refs, currentUid)
export { useLiveDoc, useLiveQuery, type Live } from './live'
export type { NewTask, TaskChanges } from './writes'
