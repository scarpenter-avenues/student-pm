// Multi-select in the task tables: the row circle selects (fills like a radio button), Shift-click selects a range,
// Esc clears. Keys are a task id, or "taskId/subtaskId" for a subtask.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * The selection key for a subtask row: its task and its own id together. A task row's key is just the task id.
 */
export const subtaskKey = (taskId: string, subtaskId: string) => `${taskId}/${subtaskId}`
/** The reverse of subtaskKey. */
export function parseKey(key: string): { taskId: string; subtaskId: string | null } {
  const [taskId = '', subtaskId = null] = key.split('/')
  return { taskId, subtaskId }
}

/**
 * Which rows are selected in a table (the circles), for the bulk bar. `order` lists every row's key from top to
 * bottom, which is what makes shift-click ranges work.
 */
export function useSelection(order: () => string[]) {
  const selected = ref<Set<string>>(new Set())
  let anchor: string | null = null

  /** Selects or deselects a row. With Shift, selects everything between the last row clicked and this one. */
  function toggle(key: string, event?: MouseEvent | KeyboardEvent) {
    const next = new Set(selected.value)
    if (event?.shiftKey && anchor) {
      const keys = order()
      const [a, b] = [keys.indexOf(anchor), keys.indexOf(key)].sort((x, y) => x - y)
      if (a !== undefined && b !== undefined && a >= 0)
        keys.slice(a, b + 1).forEach((k) => next.add(k))
    } else if (next.has(key)) next.delete(key)
    else next.add(key)
    anchor = key
    selected.value = next
  }
  /** Deselects everything. */
  function clear() {
    selected.value = new Set()
    anchor = null
  }
  // Esc clears the selection, unless something else (an open menu) already handled the key.
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && selected.value.size && !event.defaultPrevented) clear()
  }
  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

  const keys = computed(() => [...selected.value])
  return { selected, keys, toggle, clear, has: (key: string) => selected.value.has(key) }
}
