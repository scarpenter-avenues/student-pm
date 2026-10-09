// Live Firestore data as Vue refs. Pass a getter; when what it returns changes (a different team, sprint, person),
// the old listener stops and a new one starts. Return null to listen to nothing. Listeners stop with the component
// (or effect scope) that created them.
//
//   const tasks = useLiveQuery(() => team.value && queries.sprintTasks(team.value.id, sprintId.value))
//   tasks.data.value  // WithId<Task>[], updated live, including this device's own writes right away
import {
  onSnapshot,
  queryEqual,
  refEqual,
  type DocumentReference,
  type FirestoreError,
  type Query,
} from 'firebase/firestore'
import { getCurrentScope, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'

export interface Live<T> {
  /** Replaced (not mutated) on every snapshot, so it's a shallow ref. */
  data: Ref<T>
  /** True until the first snapshot for the current source arrives. */
  loading: Ref<boolean>
  /** Usually "permission-denied": the rules don't allow this read. */
  error: Ref<FirestoreError | null>
  /** The data came from the offline cache and the server hasn't confirmed it yet. */
  fromCache: Ref<boolean>
}

type Source<S> = () => S | null | undefined | false | ''

function listen<S extends object, T>(
  source: Source<S>,
  same: (a: S, b: S) => boolean,
  subscribe: (target: S, live: Live<T>) => () => void,
  empty: T,
): Live<T> {
  const live: Live<T> = {
    data: shallowRef(empty) as Ref<T>,
    loading: ref(false),
    error: shallowRef(null),
    fromCache: ref(false),
  }
  let current: S | null = null
  let stop: (() => void) | null = null

  watch(
    source,
    (next) => {
      const target = next || null
      if (target && current && same(target, current)) return
      stop?.()
      stop = null
      current = target
      live.data.value = empty
      live.error.value = null
      live.fromCache.value = false
      live.loading.value = !!target
      if (target) stop = subscribe(target, live)
    },
    { immediate: true },
  )

  if (getCurrentScope()) onScopeDispose(() => stop?.())
  return live
}

function onError(live: Live<unknown>) {
  return (error: FirestoreError) => {
    console.error(error)
    live.error.value = error
    live.loading.value = false
  }
}

export function useLiveQuery<T>(source: Source<Query<T>>): Live<T[]> {
  return listen<Query<T>, T[]>(
    source,
    queryEqual,
    (target, live) =>
      onSnapshot(
        target,
        (snapshot) => {
          live.data.value = snapshot.docs.map((d) => d.data())
          live.fromCache.value = snapshot.metadata.fromCache
          live.loading.value = false
        },
        onError(live),
      ),
    [],
  )
}

export function useLiveDoc<T>(source: Source<DocumentReference<T>>): Live<T | null> {
  return listen<DocumentReference<T>, T | null>(
    source,
    refEqual,
    (target, live) =>
      onSnapshot(
        target,
        (snapshot) => {
          live.data.value = snapshot.data() ?? null
          live.fromCache.value = snapshot.metadata.fromCache
          live.loading.value = false
        },
        onError(live),
      ),
    null,
  )
}
