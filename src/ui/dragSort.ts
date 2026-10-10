// v-drag-sort: drag tasks to reorder them, and between lists in the same group (Board columns, List status groups,
// Planning sprints). Built on SortableJS (bundled from npm), which handles mouse, touch (a short press first, so
// phones still scroll), and scrolling near the edges.
//
// Vue owns the DOM, so on drop the dragged element goes back where it was and the view gets the move as data: the
// task, the list it left and the one it landed in, and its new neighbors there. The view saves it (status, sprint,
// and a rank between the neighbors) and the live listener re-renders. Each list element carries `data-task` ids.
import Sortable from 'sortablejs'
import type { Directive } from 'vue'

export interface TaskDrop {
  id: string
  /** The `key` of the list it came from and the one it was dropped in. */
  from: string
  to: string
  /** Its new neighbors in the list it landed in (null: the start or the end). */
  beforeId: string | null
  afterId: string | null
}
export interface DragSortOptions {
  /** Lists in the same group can trade items. */
  group: string
  key: string
  /** Which children can be dragged, e.g. "tr.task-row". */
  draggable: string
  onDrop: (drop: TaskDrop) => void
  disabled?: boolean
}

const lists = new WeakMap<HTMLElement, { sortable: Sortable; options: DragSortOptions }>()
let origin: { parent: Node; next: Node | null } | null = null

function create(el: HTMLElement, options: DragSortOptions) {
  return Sortable.create(el, {
    group: options.group,
    draggable: options.draggable,
    disabled: !!options.disabled,
    // Typing and editing never start a drag.
    filter: 'input, textarea, select, [contenteditable="true"]',
    preventOnFilter: false,
    // The fallback (instead of native drag and drop) looks the same everywhere, table rows included.
    forceFallback: true,
    fallbackTolerance: 4,
    delay: 180,
    delayOnTouchOnly: true,
    touchStartThreshold: 6,
    animation: 120,
    ghostClass: 'drag-placeholder',
    chosenClass: 'drag-chosen',
    fallbackClass: 'drag-ghost',
    onStart(event) {
      origin = { parent: event.item.parentNode!, next: event.item.nextSibling }
      document.body.classList.add('is-dragging')
    },
    onEnd(event) {
      document.body.classList.remove('is-dragging')
      const item = event.item
      const target = lists.get(event.to)?.options
      const ids = Array.from(event.to.children)
        .filter((child) => child.matches(options.draggable))
        .map((child) => (child as HTMLElement).dataset.task ?? '')
      const at = ids.indexOf(item.dataset.task ?? '')
      if (origin) origin.parent.insertBefore(item, origin.next)
      origin = null
      if (!target || !item.dataset.task || at < 0) return
      if (event.from === event.to && event.oldIndex === event.newIndex) return
      target.onDrop({
        id: item.dataset.task,
        from: lists.get(event.from)?.options.key ?? '',
        to: target.key,
        beforeId: ids[at - 1] ?? null,
        afterId: ids[at + 1] ?? null,
      })
    },
  })
}

export const vDragSort: Directive<HTMLElement, DragSortOptions> = {
  mounted(el, { value }) {
    lists.set(el, { sortable: create(el, value), options: value })
  },
  updated(el, { value }) {
    const entry = lists.get(el)
    if (!entry) return
    entry.options = value
    entry.sortable.option('disabled', !!value.disabled)
  },
  beforeUnmount(el) {
    lists.get(el)?.sortable.destroy()
    lists.delete(el)
  },
}
