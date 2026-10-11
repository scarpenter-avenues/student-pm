// v-drag-sort: drag tasks to reorder them, and between lists in the same group (Board columns, List status groups,
// Planning sprints). Built on SortableJS (bundled from npm), which handles mouse, touch (a short press first, so
// phones still scroll), and scrolling near the edges.
//
// Vue owns the DOM, so on drop the dragged element goes back where it was and the view gets the move as data: the
// task, the list it left and the one it landed in, and its new neighbors there. The view saves it (status, sprint,
// and a rank between the neighbors) and the live listener re-renders. Each item carries its id in a data attribute
// (`data-task`, or `data-subtask` for the subtasks inside a Board card, which reorder within their card).
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
/** A subtask row dragged within its task (List and Planning). */
export interface SubtaskDrop {
  taskId: string
  id: string
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
  /** Which data attribute holds an item's id: "task" (data-task, the default) or "subtask". */
  idAttr?: 'task' | 'subtask'
  /** Parts of an item that never start a drag of it (a CSS selector), e.g. a card's subtask list. */
  ignore?: string
  /**
   * Tables: lets the subtask rows in this list (tr.subtask-row, with data-subtask and data-parent) be dragged
   * too. A subtask only moves among its own task's subtasks.
   */
  onDropSubtask?: (drop: SubtaskDrop) => void
}

const SUBTASK_ROW = 'tr.subtask-row'
// Whether an element is a subtask's table row.
const isSubtaskRow = (element: Element | null): element is HTMLElement =>
  !!element?.matches(SUBTASK_ROW)

const lists = new WeakMap<HTMLElement, { sortable: Sortable; options: DragSortOptions }>()
let origin: { parent: Node; next: Node | null } | null = null

/**
 * A table row lifted out of the table's layout loses its column widths, so its floating copy gets each cell's
 * width from the real row and lays them out in a line.
 */
function sizeRowCopy(row: HTMLElement, copy: HTMLTableRowElement) {
  const cells = Array.from(row.children)
  Array.from(copy.children).forEach((cell, index) => {
    const width = cells[index]?.getBoundingClientRect().width
    if (width && cell instanceof HTMLElement)
      Object.assign(cell.style, {
        flex: `0 0 ${width}px`,
        width: `${width}px`,
        boxSizing: 'border-box',
      })
  })
  Object.assign(copy.style, { display: 'flex', alignItems: 'center' })
}

// Sets up SortableJS on one list. The options here decide how dragging feels; onMove and onEnd are where the
// app's own rules live.
function create(el: HTMLElement, options: DragSortOptions) {
  return Sortable.create(el, {
    group: options.group,
    draggable: options.onDropSubtask ? `${options.draggable}, ${SUBTASK_ROW}` : options.draggable,
    disabled: !!options.disabled,
    // Typing and editing never start a drag.
    filter: ['input, textarea, select, [contenteditable="true"]', options.ignore]
      .filter(Boolean)
      .join(', '),
    preventOnFilter: false,
    // The fallback (instead of native drag and drop) looks the same everywhere, table rows included.
    forceFallback: true,
    // The floating copy lives on <body>, not inside the list: an ancestor that moves (a card's hover lift) would
    // otherwise shift where the copy is drawn, far from the pointer. Table rows are the exception: their copy
    // stays in the table so the table's cell styles still apply (see sizeRowCopy).
    fallbackOnBody: !options.draggable.startsWith('tr'),
    fallbackTolerance: 4,
    // Touch: a short press-and-hold picks it up (a swipe scrolls); a small wobble during the hold is forgiven.
    // The item lifts when the hold is long enough (.drag-chosen in base.css).
    delay: 160,
    delayOnTouchOnly: true,
    touchStartThreshold: 8,
    // Holding an item near an edge scrolls whatever scrolls there: a column, the board (sideways, to reach the
    // other columns on a phone), the page (up and down). The page itself never scrolls sideways: on iOS the
    // floating copy is positioned in the page, and following it would run off into empty space.
    scrollSensitivity: 56,
    scrollSpeed: 14,
    // Called by SortableJS when it wants to scroll something. We scroll the page ourselves, up and down only;
    // anything else is left to SortableJS ("continue").
    scrollFn(offsetX, offsetY, _event, _touch, scrolled) {
      if (scrolled !== document.scrollingElement) return 'continue'
      scrolled.scrollTop += offsetY
    },
    animation: 150,
    // An empty list (a column with no cards, a collapsed sprint) takes a drop from a little way off.
    emptyInsertThreshold: 24,
    ghostClass: 'drag-placeholder',
    chosenClass: 'drag-chosen',
    fallbackClass: 'drag-ghost',
    // Remember where the item was, so it can be put back when the drag ends.
    onStart(event) {
      origin = { parent: event.item.parentNode!, next: event.item.nextSibling }
      document.body.classList.add('is-dragging')
      // A task takes its subtasks with it, so their rows step aside; a carried subtask needs to see its siblings.
      if (!isSubtaskRow(event.item)) document.body.classList.add('is-dragging-task')
      if (Sortable.ghost instanceof HTMLTableRowElement) sizeRowCopy(event.item, Sortable.ghost)
    },
    // A subtask stays among its own task's subtasks; a task never lands between another task's subtasks.
    onMove(event) {
      if (!isSubtaskRow(event.dragged)) return !isSubtaskRow(event.related)
      return (
        event.to === event.from &&
        isSubtaskRow(event.related) &&
        event.related.dataset.parent === event.dragged.dataset.parent
      )
    },
    // The drop. Work out where the item landed, put the DOM back as it was, and report the move to the view.
    onEnd(event) {
      document.body.classList.remove('is-dragging', 'is-dragging-task')
      const item = event.item
      const target = lists.get(event.to)?.options
      if (isSubtaskRow(item)) {
        const siblings = Array.from(event.from.children)
          .filter((row) => isSubtaskRow(row) && row.dataset.parent === item.dataset.parent)
          .map((row) => (row as HTMLElement).dataset.subtask ?? '')
        const place = siblings.indexOf(item.dataset.subtask ?? '')
        if (origin) origin.parent.insertBefore(item, origin.next)
        origin = null
        if (place < 0 || !item.dataset.parent || event.oldIndex === event.newIndex) return
        options.onDropSubtask?.({
          taskId: item.dataset.parent,
          id: item.dataset.subtask!,
          beforeId: siblings[place - 1] ?? null,
          afterId: siblings[place + 1] ?? null,
        })
        return
      }
      // An item's id, from its data-task or data-subtask attribute.
      const idOf = (element: Element) => (element as HTMLElement).dataset[options.idAttr ?? 'task']
      const ids = Array.from(event.to.children)
        .filter((child) => child.matches(options.draggable))
        .map((child) => idOf(child) ?? '')
      const id = idOf(item)
      const at = ids.indexOf(id ?? '')
      if (origin) origin.parent.insertBefore(item, origin.next)
      origin = null
      if (!target || !id || at < 0) return
      if (event.from === event.to && event.oldIndex === event.newIndex) return
      target.onDrop({
        id,
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
