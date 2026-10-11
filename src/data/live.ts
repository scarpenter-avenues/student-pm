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

// The shared machinery behind useLiveQuery and useLiveDoc. Watches `source`; when it really changes (per
// `same`), it stops the old subscription, resets to `empty`, and subscribes to the new target. It stops for
// good when the component using it goes away.
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

// What every subscription does when Firestore refuses or fails: log it, keep it for the screen to show, and
// stop the loading state.
function onError(live: Live<unknown>) {
  return (error: FirestoreError) => {
    console.error(error)
    live.error.value = error
    live.loading.value = false
  }
}

/**
 * A list of documents that stays up to date. Pass a function returning the query (or null/false for "nothing
 * yet"); you get back `data`, `loading`, and `error` to use in a template.
 */
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

/** One document that stays up to date; `data` is null while it loads or if it does not exist. */
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
