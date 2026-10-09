// Firestore ↔ app objects: documents come back as their data plus `id`, and the `id` is dropped on write.
import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore'
import type { WithId } from '@/model/types'

const withId: FirestoreDataConverter<WithId<DocumentData>, DocumentData> = {
  toFirestore(value) {
    const { id: _id, ...data } = value as DocumentData
    return data
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions) {
    // A timestamp we just wrote shows its local estimate until the server confirms it, never null.
    return { ...snapshot.data({ ...options, serverTimestamps: 'estimate' }), id: snapshot.id }
  },
}

export function converter<T extends DocumentData>(): FirestoreDataConverter<WithId<T>, T> {
  return withId as unknown as FirestoreDataConverter<WithId<T>, T>
}
