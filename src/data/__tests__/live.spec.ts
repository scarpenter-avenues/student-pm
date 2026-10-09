import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

// A stand-in for Firestore's onSnapshot: records listeners so tests can push snapshots.
type Listener = {
  target: { key: string }
  next: (s: unknown) => void
  error: (e: unknown) => void
  stopped: boolean
}
const listeners: Listener[] = []
vi.mock('firebase/firestore', () => ({
  onSnapshot: (target: { key: string }, next: Listener['next'], error: Listener['error']) => {
    const listener = { target, next, error, stopped: false }
    listeners.push(listener)
    return () => (listener.stopped = true)
  },
  queryEqual: (a: { key: string }, b: { key: string }) => a.key === b.key,
  refEqual: (a: { key: string }, b: { key: string }) => a.key === b.key,
}))

import { useLiveDoc, useLiveQuery } from '../live'

const query = (key: string) => ({ key }) as never
const snapshot = (rows: object[], fromCache = false) => ({
  docs: rows.map((row) => ({ data: () => row })),
  metadata: { fromCache },
})

describe('useLiveQuery', () => {
  it('follows its source: same query keeps the listener, a new one replaces it, null stops', async () => {
    listeners.length = 0
    const team = ref<string | null>('a')
    const tick = ref(0)
    const scope = effectScope()
    const live = scope.run(() => useLiveQuery(() => (tick.value, team.value && query(team.value))))!
    expect(live.loading.value).toBe(true)
    expect(listeners).toHaveLength(1)

    listeners[0]!.next(snapshot([{ id: 't1' }], true))
    expect(live.data.value).toEqual([{ id: 't1' }])
    expect(live.fromCache.value).toBe(true)
    expect(live.loading.value).toBe(false)

    tick.value++ // the getter re-runs and builds an equal query
    await nextTick()
    expect(listeners).toHaveLength(1)

    team.value = 'b'
    await nextTick()
    expect(listeners[0]!.stopped).toBe(true)
    expect(listeners).toHaveLength(2)
    expect(live.data.value).toEqual([]) // no stale rows from the old team
    expect(live.loading.value).toBe(true)

    team.value = null
    await nextTick()
    expect(listeners[1]!.stopped).toBe(true)
    expect(live.loading.value).toBe(false)

    team.value = 'c'
    await nextTick()
    scope.stop()
    expect(listeners[2]!.stopped).toBe(true)
  })

  it('reports errors (e.g. the rules refuse the read)', () => {
    listeners.length = 0
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const live = effectScope().run(() => useLiveQuery(() => query('x')))!
    listeners[0]!.error({ code: 'permission-denied' })
    expect(live.error.value).toEqual({ code: 'permission-denied' })
    expect(live.loading.value).toBe(false)
  })
})

describe('useLiveDoc', () => {
  it('gives the document, or null when it does not exist', () => {
    listeners.length = 0
    const live = effectScope().run(() => useLiveDoc(() => query('doc')))!
    listeners[0]!.next({
      data: () => ({ id: 'home', html: '<p>Hi</p>' }),
      metadata: { fromCache: false },
    })
    expect(live.data.value).toEqual({ id: 'home', html: '<p>Hi</p>' })
    listeners[0]!.next({ data: () => undefined, metadata: { fromCache: false } })
    expect(live.data.value).toBeNull()
  })
})
