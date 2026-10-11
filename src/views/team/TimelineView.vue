<script setup lang="ts">
// Timeline: the season's days across, one task per row in Planning's order (top is first), under a header row for
// each subteam (a task with several sits in its first; "No subteam" last). Dense 34px rows; no column of names on
// the left, since the bars carry their titles. Bar color + icon = status. "Group by subteam" can be switched off
// (remembered on this device) for one list in exactly Planning's order, each bar marked with its subteam's color. Solid lines only at sprint boundaries; event days are dashed
// (competitions purple, work sessions teal, other gray). Opens on the current sprint's first day unless today would
// be off-screen. Titles too long for their bar run past its right edge, and lanes leave room so they never overlap.
// Drag a bar's middle to move it (its dates shift together) or an end to change that date; it snaps to days and
// saves on release, with Undo. A row whose task starts off-screen to the right isn't left empty: a "Later" column
// appears at the right edge, where the chart fades out, naming it; clicking jumps there.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { writes } from '@/data'
import { todayIso } from '@/model/dates'
import type { Status, Subtask, Task, WithId } from '@/model/types'
import { useTaskView } from '@/composables/useTaskView'
import { EVENT_ICONS, useEvents } from '@/composables/useEvents'
import { useClickAway } from '@/composables/usePopover'
import { useTaskPanel } from '@/stores/taskPanel'
import { useToast } from '@/stores/toast'
import { formatEventDate, formatShortDate, plural } from '@/ui/format'
import { SUBTEAM_PALETTE } from '@/ui/palette'
import {
  TIMELINE_ZOOMS,
  barWidth,
  contentWidth,
  dateSpan,
  dragDates,
  type BarDrag,
  daysBetween,
  shiftIsoDate,
  timelineRange,
} from '@/ui/timeline'
import { updateSubtask } from '@/model/subtasks'
import AnnouncementBanner from '@/components/tasks/AnnouncementBanner.vue'
import SprintHeader from '@/components/tasks/SprintHeader.vue'
import TaskFilterBar from '@/components/tasks/TaskFilterBar.vue'
import AvatarStack from '@/components/ui/AvatarStack.vue'

// No fixed column on the left: each subteam is a header row.
const LABEL_W = 0
const LANE_H = 34
/** A subteam's header row, and the "Later" column at the right edge. */
const LABEL_H = 34
const LATER_W = 230
const SUB_ROW = 30

const { team, sprint, visible } = useTaskView(() => false)
const panel = useTaskPanel()
const toast = useToast()
const { events } = useEvents(() => team.teamId.value)
const zoom = ref(2)
const dayWidth = computed(() => TIMELINE_ZOOMS[zoom.value]!.day)
const range = computed(() => timelineRange(team.sprints.value))
const today = todayIso()
const collapsed = ref<Set<string>>(new Set())
const expanded = ref<Set<string>>(new Set())

// Grouped by subteam (the default), or one list in Planning's order. Remembered on this device.
const GROUPED_KEY = 'switchback.timeline.grouped'
// Whether "Group by subteam" was left on (the default) on this device.
function storedGrouped() {
  try {
    return localStorage.getItem(GROUPED_KEY) !== 'no'
  } catch {
    return true
  }
}
const grouped = ref(storedGrouped())
watch(grouped, (on) => {
  try {
    localStorage.setItem(GROUPED_KEY, on ? 'yes' : 'no')
  } catch {
    // Private windows can refuse storage; the choice just lasts for this visit.
  }
})
/** The header row's height, when there is one. */
const labelHeight = computed(() => (grouped.value ? LABEL_H : 0))
// The subteam a task is grouped under: the first of its subteams, in the team's order.
const firstSubteam = (task: Task) =>
  team.subteams.value.find((subteam) => task.subteamIds.includes(subteam.id)) ?? null

// ---------- measuring titles (bar font) ----------
const context = document.createElement('canvas').getContext('2d')
const fontFamily = getComputedStyle(document.body).fontFamily
// How wide a title is in the bars' font, measured on a hidden canvas (a rough guess if there isn't one).
function textWidth(text: string) {
  if (!context) return text.length * 7
  context.font = `600 12px ${fontFamily}`
  return context.measureText(text).width
}
// A task's subtasks, without the archived ones.
const activeSubtasks = (task: Task) => task.subtasks.filter((item) => !item.archived)
// How far a bar's contents (title, initials, subtask count) run past its right end, in pixels. Layout leaves
// that much room so nothing overlaps.
function overflowPx(
  title: string,
  people: number,
  span: [string, string],
  subtaskCount: boolean,
  subteamDot = false,
) {
  return Math.max(
    0,
    contentWidth(textWidth(title), people, subtaskCount) +
      (subteamDot ? 9 + 7 : 0) -
      barWidth(span, dayWidth.value),
  )
}

// ---------- layout ----------
const x = (iso: string) => (range.value ? daysBetween(range.value.start, iso) * dayWidth.value : 0)

interface Item {
  task: WithId<Task>
  span: [string, string]
  dated: { subtask: Subtask; span: [string, string] }[]
  undated: number
  expandable: boolean
  expanded: boolean
  reach: [string, string]
  overflow: number
}
const groups = computed(() => {
  const order: { id: string | null; name: string }[] = grouped.value
    ? [
        ...team.subteams.value.map((s) => ({ id: s.id, name: s.name })),
        { id: '', name: 'No subteam' },
      ]
    : // One list of everything (id null), in Planning's order.
      [{ id: null, name: '' }]
  return order
    .map(({ id, name }) => {
      const items: Item[] = visible.value
        .filter((task) => id === null || (firstSubteam(task)?.id ?? '') === id)
        .flatMap((task) => {
          const span = dateSpan(task)
          if (!span) return []
          const subs = activeSubtasks(task)
          const dated = subs.flatMap((subtask) => {
            const s = dateSpan(subtask)
            return s ? [{ subtask, span: s }] : []
          })
          const expandable = dated.length > 0
          const isOpen = expandable && expanded.value.has(task.id)
          const reach: [string, string] = isOpen
            ? dated.reduce<[string, string]>(
                (r, d) => [
                  d.span[0] < r[0] ? d.span[0] : r[0],
                  d.span[1] > r[1] ? d.span[1] : r[1],
                ],
                [...span],
              )
            : span
          const overflow = overflowPx(
            task.title,
            task.assigneeIds.length,
            span,
            subs.length > 0,
            !grouped.value && !!firstSubteam(task),
          )
          return [
            {
              task,
              span,
              dated,
              undated: subs.length - dated.length,
              expandable,
              expanded: isOpen,
              reach,
              overflow,
            },
          ]
        })
      // One row per task, in Planning's order (order is priority): by sprint, then rank. `visible` is already in
      // rank order; with All sprints showing, earlier sprints come first and the Backlog last.
      const sprintOrder = (item: Item) => {
        const index = item.task.sprintId
          ? team.sprints.value.findIndex((s) => s.id === item.task.sprintId)
          : -1
        return index < 0 ? Number.MAX_SAFE_INTEGER : index
      }
      items.sort((a, b) => sprintOrder(a) - sprintOrder(b))
      const lanes = items.map((_, index) => index)
      const count = items.length
      // The height of a task's expanded subtask panel.
      const panelHeight = (item: Item) =>
        6 + item.dated.length * SUB_ROW + (item.undated ? 24 : 0) + 12
      const extra = Array.from({ length: count }, (_, lane) =>
        Math.max(
          0,
          ...items.filter((item, i) => lanes[i] === lane && item.expanded).map(panelHeight),
        ),
      )
      const tops = extra.map(
        (_, lane) => 5 + extra.slice(0, lane).reduce((sum, e) => sum + e, 0) + lane * LANE_H,
      )
      return {
        id: id ?? 'all',
        name,
        items: items.map((item, i) => ({ ...item, top: tops[lanes[i]!]! })),
        height: count * LANE_H + extra.reduce((sum, e) => sum + e, 0) + 4,
      }
    })
    .filter((group) => group.items.length)
})
const undated = computed(() => visible.value.filter((task) => !dateSpan(task)))

const days = computed(() => {
  if (!range.value) return []
  return Array.from({ length: range.value.days }, (_, i) => {
    const iso = shiftIsoDate(range.value!.start, i)
    const date = new Date(`${iso}T00:00:00Z`)
    return {
      iso,
      day: date.getUTCDate(),
      weekend: [0, 6].includes(date.getUTCDay()),
      monday: date.getUTCDay() === 1,
    }
  })
})
const months = computed(() => {
  const list: { label: string; left: number; width: number }[] = []
  let start = 0
  days.value.forEach((day, i) => {
    const last = i === days.value.length - 1
    if ((i > 0 && day.day === 1) || last) {
      const end = last ? i + 1 : i
      const first = new Date(`${days.value[start]!.iso}T00:00:00Z`)
      list.push({
        label: first.toLocaleDateString('en-US', {
          month: 'long',
          timeZone: 'UTC',
          ...(first.getUTCMonth() === 0 ? { year: 'numeric' } : {}),
        }),
        left: start * dayWidth.value,
        width: (end - start) * dayWidth.value,
      })
      start = i
    }
  })
  return list
})
const visibleEvents = computed(() =>
  range.value
    ? events.value.filter(
        (e) =>
          e.date >= range.value!.start &&
          daysBetween(range.value!.start, e.date) < range.value!.days,
      )
    : [],
)
const width = computed(() => (range.value?.days ?? 0) * dayWidth.value)

// ---------- actions ----------
const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)
// The status icon on a bar: Done, or back to To do.
function toggleDone(task: WithId<Task>) {
  writes
    .updateTask(team.teamId.value!, task.id, { status: task.status === 'Done' ? 'To do' : 'Done' })
    .catch(fail)
}
// The same for a subtask bar.
function toggleSubDone(task: WithId<Task>, subtask: Subtask) {
  const status: Status = subtask.status === 'Done' ? 'To do' : 'Done'
  writes
    .updateTask(team.teamId.value!, task.id, {
      subtasks: updateSubtask(task.subtasks, subtask.id, { status }),
    })
    .catch(fail)
}
// Collapses a subteam group, or expands a task's subtask panel.
function toggleSet(which: 'collapsed' | 'expanded', id: string) {
  const set = which === 'collapsed' ? collapsed : expanded
  const next = new Set(set.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  set.value = next
}
// "+ Add task": opens a new task in the sprint showing.
function addTask() {
  const shown = sprint.value
  panel.create(
    team.teamId.value!,
    shown && shown !== 'all' ? shown.id : (team.currentSprint.value?.id ?? null),
  )
}
// A bar's tooltip: title · status · dates.
const barTitle = (title: string, status: string, span: [string, string]) =>
  `${title} · ${status} · ${formatShortDate(span[0])}${span[0] === span[1] ? '' : ` – ${formatShortDate(span[1])}`}`

// ---------- dragging bars: move, or pull an end ----------
// While a bar is dragged only that bar is redrawn (shifted and resized in whole days); lanes repack when the new
// dates are saved. A press that doesn't move is still a click, which opens the task.
type Dates = { start: string | null; due: string | null }
const drag = ref<{ key: string; mode: BarDrag; days: number } | null>(null)
let dragFrom: {
  x: number
  scroll: number
  moved: boolean
  dates: Dates
  save: (dates: Dates) => void
  title: string
} | null = null
let justDragged = false
// One key per bar, so a drag knows which bar it is moving (a subtask's includes its task).
const barKey = (task: WithId<Task>, subtask?: Subtask) =>
  subtask ? `${task.id}/${subtask.id}` : task.id

/** The dates a bar shows: its own, or where the drag has taken it. */
function shownSpan(key: string, dates: Dates, span: [string, string]): [string, string] {
  const d = drag.value
  return (d && d.key === key && dateSpan(dragDates(dates, d.mode, d.days))) || span
}
/** While dragged, a bar shifts and resizes in place (its lane and neighbors wait for the save). */
function dragStyle(key: string, dates: Dates, span: [string, string]) {
  if (drag.value?.key !== key) return {}
  const shown = shownSpan(key, dates, span)
  return {
    transform: `translateX(${daysBetween(span[0], shown[0]) * dayWidth.value}px)`,
    width: `${barWidth(shown, dayWidth.value)}px`,
  }
}
// Dates as "Oct 6 – Oct 12", or one date when they are the same day.
const spanLabel = (span: [string, string]) =>
  `${formatShortDate(span[0])}${span[0] === span[1] ? '' : ` – ${formatShortDate(span[1])}`}`

// Pointer down on a bar. Which part was grabbed decides the drag: the middle moves the bar, an end changes that
// date.
function startDrag(event: PointerEvent, task: WithId<Task>, subtask?: Subtask) {
  // Touch scrolls the timeline; dragging is for a mouse, trackpad, or pen.
  if (event.button !== 0 || event.pointerType === 'touch') return
  const from = event.target as HTMLElement
  if (from.closest('.status-icon')) return
  const bar = event.currentTarget as HTMLElement
  const mode = (from.closest<HTMLElement>('.tl-grip')?.dataset.edge ?? 'move') as BarDrag
  const source = subtask ?? task
  dragFrom = {
    x: event.clientX,
    scroll: scroller.value?.scrollLeft ?? 0,
    moved: false,
    dates: { start: source.start, due: source.due },
    title: source.title,
    save: (dates) =>
      writes
        .updateTask(
          team.teamId.value!,
          task.id,
          subtask
            ? {
                subtasks: updateSubtask(
                  team.tasks.value.find((t) => t.id === task.id)?.subtasks ?? task.subtasks,
                  subtask.id,
                  dates,
                ),
              }
            : dates,
        )
        .catch(fail),
  }
  drag.value = { key: barKey(task, subtask), mode, days: 0 }
  bar.setPointerCapture(event.pointerId)
}
// Pointer moved: turns the distance into whole days (allowing for any sideways scrolling since the drag began).
function moveDrag(event: PointerEvent) {
  if (!dragFrom || !drag.value) return
  const dx = event.clientX - dragFrom.x + ((scroller.value?.scrollLeft ?? 0) - dragFrom.scroll)
  if (Math.abs(dx) > 3) dragFrom.moved = true
  if (dragFrom.moved) drag.value = { ...drag.value, days: Math.round(dx / dayWidth.value) }
}
// Pointer up: saves the new dates if the bar really moved, with Undo in the toast. Esc or a lost pointer cancels.
function endDrag(event: PointerEvent, cancelled = false) {
  const from = dragFrom
  const state = drag.value
  dragFrom = null
  drag.value = null
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
  if (!from || !state || !from.moved) return
  // The click that follows a drag isn't a click on the task.
  justDragged = true
  setTimeout(() => (justDragged = false), 0)
  const next = dragDates(from.dates, state.mode, state.days)
  if (cancelled || (next.start === from.dates.start && next.due === from.dates.due)) return
  from.save(next)
  const span = dateSpan(next)
  toast.show(`“${from.title}” is now ${span ? spanLabel(span) : 'undated'}`, {
    label: 'Undo',
    run: () => from.save(from.dates),
  })
}
// A click opens the task panel; the click that ends a drag does not.
function openBar(task: WithId<Task>, subtask?: Subtask) {
  if (!justDragged) panel.open(team.teamId.value!, task.id, subtask?.id)
}

// ---------- No date menu ----------
const noDateOpen = ref(false)
const noDateRoot = ref<HTMLElement | null>(null)
useClickAway(
  () => [noDateRoot.value],
  () => (noDateOpen.value = false),
)

// ---------- scrolling and zoom ----------
const scroller = ref<HTMLElement | null>(null)

// ---------- "Later": tasks that start past the right edge of the view ----------
const view = reactive({ left: 0, width: 0 })
// Notes how much of the chart is showing, to work out which bars start past the right edge.
function measureView() {
  if (!scroller.value) return
  view.left = scroller.value.scrollLeft
  view.width = scroller.value.clientWidth
}
let viewObserver: ResizeObserver | null = null
onMounted(() => {
  measureView()
  if (scroller.value && typeof ResizeObserver !== 'undefined') {
    viewObserver = new ResizeObserver(measureView)
    viewObserver.observe(scroller.value)
  }
})
onBeforeUnmount(() => viewObserver?.disconnect())
/** Starts beyond what's showing (allowing for the Later column itself, once it's there). */
const startsLater = (span: [string, string], column: boolean) =>
  view.width > 0 && x(span[0]) > view.left + view.width - (column ? LATER_W : 0) - 30
const laterShown = computed(() =>
  groups.value.some(
    (group) =>
      !collapsed.value.has(group.id) && group.items.some((item) => startsLater(item.span, false)),
  ),
)
// Does this bar belong in the Later column?
const isLater = (span: [string, string]) => laterShown.value && startsLater(span, true)
// Scrolls so a day sits `lead` days in from the left edge.
function scrollTo(iso: string, lead = 5) {
  if (scroller.value && range.value)
    scroller.value.scrollLeft = (daysBetween(range.value.start, iso) - lead) * dayWidth.value
}
/** Show the current sprint from its first day, unless today would end up off-screen. */
function scrollToSprint() {
  const first = team.currentSprint.value?.start
  if (!scroller.value || !first) return
  const visibleDays = Math.floor((scroller.value.clientWidth - LABEL_W) / dayWidth.value)
  if (daysBetween(first, today) < visibleDays - 3) scrollTo(first, 1)
  else scrollTo(today)
}
let scrolled = false
watch(
  () => range.value && team.currentSprint.value,
  async (ready) => {
    if (!ready || scrolled) return
    scrolled = true
    await nextTick()
    scrollToSprint()
  },
  { immediate: true },
)
onMounted(() => nextTick(() => scrolled && scrollToSprint()))
// Zooms in or out a step, keeping the same day in the middle of the view.
function zoomBy(step: number) {
  const next = Math.min(TIMELINE_ZOOMS.length - 1, Math.max(0, zoom.value + step))
  if (next === zoom.value || !scroller.value) return
  const el = scroller.value
  const before = dayWidth.value
  const centerDay = (el.scrollLeft + el.clientWidth / 2 - LABEL_W / 2) / before
  zoom.value = next
  void nextTick(() => {
    el.scrollLeft = centerDay * dayWidth.value - el.clientWidth / 2 + LABEL_W / 2
  })
}
</script>

<template>
  <AnnouncementBanner />
  <SprintHeader :sprint="sprint" picker />
  <TaskFilterBar
    :count="visible.length"
    :scope="sprint === 'all' ? 'All sprints' : 'Current sprint'"
  />
  <div class="timeline-view">
    <div class="timeline-toolbar">
      <button class="quiet-button" type="button" @click="addTask">＋ Add task</button>
      <div class="legend" aria-label="Status key">
        <span><i class="status-icon" data-state="To do" />To do</span>
        <span><i class="status-icon" data-state="In progress" />In progress</span>
        <span><i class="status-icon" data-state="Done" />Done</span>
      </div>
      <div v-if="undated.length" ref="noDateRoot" class="nodate">
        <button
          class="quiet-button"
          type="button"
          :aria-expanded="noDateOpen"
          @click="noDateOpen = !noDateOpen"
        >
          No date ({{ undated.length }})
        </button>
        <div v-if="noDateOpen" class="nodate-menu">
          <button
            v-for="task in undated"
            :key="task.id"
            type="button"
            @click="((noDateOpen = false), panel.open(team.teamId.value!, task.id))"
          >
            <span>{{ task.title }}</span>
            <small>{{
              team.subteams.value
                .filter((s) => task.subteamIds.includes(s.id))
                .map((s) => s.name)
                .join(', ')
            }}</small>
          </button>
        </div>
      </div>
      <label class="group-toggle">
        <input v-model="grouped" type="checkbox" />
        Group by subteam
      </label>
      <div class="zoom">
        <button type="button" aria-label="Zoom out" :disabled="zoom === 0" @click="zoomBy(-1)">
          −
        </button>
        <span>{{ TIMELINE_ZOOMS[zoom]!.label }}</span>
        <button
          type="button"
          aria-label="Zoom in"
          :disabled="zoom === TIMELINE_ZOOMS.length - 1"
          @click="zoomBy(1)"
        >
          ＋
        </button>
      </div>
    </div>

    <div ref="scroller" class="timeline-scroll" @scroll.passive="measureView">
      <div
        v-if="range"
        class="canvas"
        :style="{
          width: `${LABEL_W + width}px`,
          '--label-w': `${LABEL_W}px`,
          '--lane-h': `${LANE_H}px`,
        }"
      >
        <div class="tl-header">
          <div v-if="laterShown" class="tl-later tl-later-head">
            <div class="later-strip" :style="{ width: `${LATER_W}px` }"><span>Later</span></div>
          </div>
          <div class="tl-scale" :style="{ width: `${width}px` }">
            <div
              v-for="month in months"
              :key="month.left"
              class="tl-month"
              :style="{ left: `${month.left}px`, width: `${month.width}px` }"
            >
              <span>{{ month.label }}</span>
            </div>
            <div
              v-for="(day, i) in days"
              :key="day.iso"
              class="tl-day"
              :class="{ weekend: day.weekend, today: day.iso === today }"
              :style="{
                left: `${i * dayWidth}px`,
                width: `${dayWidth}px`,
                borderLeftColor: dayWidth >= 24 || day.monday ? undefined : 'transparent',
              }"
            >
              <span v-if="dayWidth >= 24 || day.monday || day.iso === today">{{ day.day }}</span>
            </div>
            <div
              v-for="s in team.sprints.value"
              :key="s.id"
              class="tl-sprint"
              :class="{ current: s.id === team.currentSprint.value?.id }"
              :style="{
                left: `${x(s.start)}px`,
                width: `${(daysBetween(s.start, s.end) + 1) * dayWidth}px`,
              }"
            >
              <span>{{ s.name }}</span>
            </div>
            <div
              v-for="event in visibleEvents"
              :key="event.id"
              class="tl-event"
              :data-type="event.type"
              :title="`${event.title} · ${formatEventDate(event.date)}`"
              :style="{ left: `${x(event.date) + dayWidth / 2 - 1}px` }"
            >
              {{ EVENT_ICONS[event.type] }} {{ event.title }}
            </div>
          </div>
        </div>

        <div class="tl-body">
          <div class="tl-bg" :style="{ width: `${width}px` }">
            <template v-for="(day, i) in days" :key="day.iso">
              <div
                v-if="day.weekend"
                class="tl-weekend"
                :style="{ left: `${i * dayWidth}px`, width: `${dayWidth}px` }"
              />
            </template>
            <div
              v-for="s in team.sprints.value.slice(1)"
              :key="s.id"
              class="tl-sprint-line"
              :style="{ left: `${x(s.start)}px` }"
            />
            <div
              class="tl-sprint-line"
              :style="{ left: `${x(team.sprints.value.at(-1)!.end) + dayWidth}px` }"
            />
            <div
              v-for="event in visibleEvents"
              :key="event.id"
              class="tl-event-line"
              :data-type="event.type"
              :style="{ left: `${x(event.date) + dayWidth / 2 - 1}px` }"
            />
            <div
              v-if="today >= range.start && daysBetween(range.start, today) < range.days"
              class="tl-today"
              :style="{ left: `${x(today) + dayWidth / 2}px` }"
            />
          </div>

          <section
            v-for="group in groups"
            :key="group.id"
            class="tl-group"
            :class="{ collapsed: collapsed.has(group.id) }"
          >
            <div v-if="laterShown" class="tl-later">
              <div
                class="later-strip"
                :style="{
                  width: `${LATER_W}px`,
                  height: `${labelHeight + (collapsed.has(group.id) ? 4 : group.height)}px`,
                }"
              >
                <template v-if="!collapsed.has(group.id)">
                  <template v-for="item in group.items" :key="item.task.id">
                    <button
                      v-if="isLater(item.span)"
                      type="button"
                      class="later-chip"
                      :data-state="item.task.status"
                      :title="`${barTitle(item.task.title, item.task.status, item.span)} · Show it`"
                      :style="{ top: `${labelHeight + item.top}px` }"
                      @click="scrollTo(item.span[0], 3)"
                    >
                      <span class="later-title">{{ item.task.title }}</span>
                      <span class="later-date">{{ formatShortDate(item.span[0]) }} ›</span>
                    </button>
                  </template>
                </template>
              </div>
            </div>
            <div v-if="grouped" class="tl-label">
              <button
                type="button"
                :aria-expanded="!collapsed.has(group.id)"
                @click="toggleSet('collapsed', group.id)"
              >
                <span class="chevron" aria-hidden="true">▼</span>
                <span class="label-name">{{ group.name }}</span>
                <small>{{ group.items.length }}</small>
              </button>
            </div>
            <div
              class="tl-lanes"
              :style="{
                width: `${width}px`,
                height: collapsed.has(group.id) ? undefined : `${group.height}px`,
              }"
            >
              <template v-if="!collapsed.has(group.id)">
                <template v-for="item in group.items" :key="item.task.id">
                  <div
                    class="tl-bar"
                    :class="{
                      'label-overflows': item.overflow > 0,
                      dragging: drag?.key === barKey(item.task),
                    }"
                    :data-state="item.task.status"
                    role="button"
                    tabindex="0"
                    :title="
                      drag ? undefined : barTitle(item.task.title, item.task.status, item.span)
                    "
                    :style="{
                      left: `${x(item.span[0]) + 2}px`,
                      width: `${barWidth(item.span, dayWidth)}px`,
                      top: `${item.top}px`,
                      ...dragStyle(barKey(item.task), item.task, item.span),
                    }"
                    @pointerdown="startDrag($event, item.task)"
                    @pointermove="moveDrag"
                    @pointerup="endDrag($event)"
                    @pointercancel="endDrag($event, true)"
                    @click="openBar(item.task)"
                    @keydown.enter.prevent="panel.open(team.teamId.value!, item.task.id)"
                  >
                    <span class="tl-grip" data-edge="start" aria-hidden="true" />
                    <span class="tl-grip" data-edge="end" aria-hidden="true" />
                    <span v-if="drag?.key === barKey(item.task)" class="tl-drag-dates">{{
                      spanLabel(shownSpan(barKey(item.task), item.task, item.span))
                    }}</span>
                    <span
                      v-if="!grouped && firstSubteam(item.task)"
                      class="subteam-dot"
                      :title="firstSubteam(item.task)!.name"
                      :style="{ background: SUBTEAM_PALETTE[firstSubteam(item.task)!.color].fg }"
                    />
                    <button
                      type="button"
                      class="status-icon"
                      :data-state="item.task.status"
                      :aria-label="`${item.task.status === 'Done' ? 'Reopen' : 'Complete'} ${item.task.title}`"
                      @click.stop="toggleDone(item.task)"
                    />
                    <span class="bar-title">{{ item.task.title }}</span>
                    <AvatarStack
                      v-if="item.task.assigneeIds.length"
                      :names="item.task.assigneeIds.map(team.nameOf)"
                      :max="2"
                    />
                    <span v-if="activeSubtasks(item.task).length" class="bar-subtasks">
                      {{ activeSubtasks(item.task).filter((s) => s.status === 'Done').length }}/{{
                        activeSubtasks(item.task).length
                      }}
                      ☷
                    </span>
                  </div>
                  <button
                    v-if="item.expandable"
                    type="button"
                    class="tl-expand"
                    :aria-expanded="item.expanded"
                    :aria-label="`${item.expanded ? 'Hide' : 'Show'} subtasks of ${item.task.title}`"
                    :style="{
                      left: `${x(item.span[0]) - 22}px`,
                      top: `${item.top + (LANE_H - 8 - 20) / 2}px`,
                    }"
                    @click="toggleSet('expanded', item.task.id)"
                  />
                  <div
                    v-if="item.expanded"
                    class="tl-subpanel"
                    :data-state="item.task.status"
                    :style="{
                      left: `${x(item.reach[0])}px`,
                      minWidth: `${(daysBetween(item.reach[0], item.reach[1]) + 1) * dayWidth}px`,
                      top: `${item.top + LANE_H - 2}px`,
                    }"
                  >
                    <div
                      v-for="d in item.dated"
                      :key="d.subtask.id"
                      class="tl-sub-row"
                      :style="{
                        paddingLeft: `${daysBetween(item.reach[0], d.span[0]) * dayWidth + 2}px`,
                      }"
                    >
                      <div
                        class="tl-bar tl-sub-bar"
                        :class="{
                          dragging: drag?.key === barKey(item.task, d.subtask),
                          'label-overflows':
                            overflowPx(
                              d.subtask.title,
                              d.subtask.assigneeIds.length,
                              d.span,
                              false,
                            ) > 0,
                        }"
                        :data-state="d.subtask.status"
                        role="button"
                        tabindex="0"
                        :title="
                          drag ? undefined : barTitle(d.subtask.title, d.subtask.status, d.span)
                        "
                        :style="{
                          width: `${barWidth(d.span, dayWidth)}px`,
                          marginRight: `${overflowPx(d.subtask.title, d.subtask.assigneeIds.length, d.span, false) + 10}px`,
                          ...dragStyle(barKey(item.task, d.subtask), d.subtask, d.span),
                        }"
                        @pointerdown="startDrag($event, item.task, d.subtask)"
                        @pointermove="moveDrag"
                        @pointerup="endDrag($event)"
                        @pointercancel="endDrag($event, true)"
                        @click="openBar(item.task, d.subtask)"
                        @keydown.enter.prevent="
                          panel.open(team.teamId.value!, item.task.id, d.subtask.id)
                        "
                      >
                        <span class="tl-grip" data-edge="start" aria-hidden="true" />
                        <span class="tl-grip" data-edge="end" aria-hidden="true" />
                        <span
                          v-if="drag?.key === barKey(item.task, d.subtask)"
                          class="tl-drag-dates"
                          >{{
                            spanLabel(shownSpan(barKey(item.task, d.subtask), d.subtask, d.span))
                          }}</span
                        >
                        <button
                          type="button"
                          class="status-icon"
                          :data-state="d.subtask.status"
                          :aria-label="`${d.subtask.status === 'Done' ? 'Reopen' : 'Complete'} ${d.subtask.title}`"
                          @click.stop="toggleSubDone(item.task, d.subtask)"
                        />
                        <span class="bar-title">{{ d.subtask.title }}</span>
                        <AvatarStack
                          v-if="d.subtask.assigneeIds.length"
                          :names="d.subtask.assigneeIds.map(team.nameOf)"
                          :max="2"
                        />
                      </div>
                    </div>
                    <button
                      v-if="item.undated"
                      type="button"
                      class="sub-note"
                      @click="panel.open(team.teamId.value!, item.task.id)"
                    >
                      {{ plural(item.undated, 'more subtask has', 'more subtasks have') }} no dates
                    </button>
                  </div>
                </template>
              </template>
            </div>
          </section>
          <p v-if="!groups.length" class="empty">
            No dated tasks{{ undated.length ? ' (see No date)' : '' }}.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-view {
  border-top: 1px solid var(--line);
}
.timeline-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 0;
}
.legend {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
  color: #66717a;
  font-size: 13px;
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.nodate {
  position: relative;
}
.nodate-menu {
  position: absolute;
  z-index: 15;
  top: calc(100% + 6px);
  right: 0;
  width: 260px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  box-shadow: var(--shadow);
}
.nodate-menu button {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  font-size: 13px;
  text-align: left;
}
.nodate-menu button:hover {
  background: var(--team-softer);
  color: var(--team-ink);
}
.nodate-menu small {
  color: #858e96;
  white-space: nowrap;
}
.group-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #4d5962;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}
/* Ungrouped: a dot in the subteam's color at the start of each bar. */
.subteam-dot {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-radius: 3px;
}
.zoom {
  display: flex;
  align-items: center;
  gap: 2px;
  color: #4d5962;
  font-size: 13px;
}
.zoom span {
  min-width: 52px;
  text-align: center;
}
.zoom button {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #4d5962;
  font-size: 16px;
}
.zoom button:hover:not(:disabled) {
  background: #f3f5f8;
}
.zoom button:disabled {
  color: #c3c9ce;
  cursor: default;
}
.timeline-scroll {
  overflow-x: auto;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.canvas {
  position: relative;
  min-width: 100%;
}
.tl-header {
  display: flex;
  border-bottom: 1px solid var(--line);
  background: #fff;
}
.tl-scale {
  position: relative;
  flex: 0 0 auto;
  height: 86px;
}
.tl-month,
.tl-sprint,
.tl-day {
  position: absolute;
  display: flex;
  align-items: center;
  white-space: nowrap;
}
.tl-month span,
.tl-sprint span {
  position: sticky;
  left: calc(var(--label-w) + 8px);
}
.tl-month {
  top: 0;
  height: 24px;
  padding-left: 8px;
  border-left: 1px solid var(--line);
  color: #303941;
  font-size: 13px;
  font-weight: 600;
}
.tl-sprint {
  top: 24px;
  height: 18px;
  border-left: 2px solid var(--team-ink);
  color: #59636d;
  font-size: 11px;
  font-weight: 650;
}
.tl-sprint span {
  padding: 1px 8px 1px 5px;
  border-radius: 0 10px 10px 0;
  background: #f0f2f4;
}
.tl-sprint.current {
  background: var(--team-softer);
  color: var(--team-ink);
}
.tl-sprint.current span {
  background: var(--team-soft);
}
.tl-day {
  top: 62px;
  height: 24px;
  justify-content: center;
  overflow: hidden;
  border-left: 1px solid #edf0f2;
  color: #59636d;
  font-size: 12px;
}
.tl-day.weekend {
  background: #f3f4f6;
}
.tl-day.today span {
  display: grid;
  min-width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 10px;
  background: #356fd1;
  color: #fff;
  font-weight: 700;
}
.tl-event {
  position: absolute;
  top: 42px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 18px;
  max-width: 180px;
  margin-top: 1px;
  padding: 0 7px 0 5px;
  overflow: hidden;
  border-left: 2px solid;
  border-radius: 0 10px 10px 0;
  font-size: 11px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tl-event[data-type='Competition'] {
  border-color: #7b5bd6;
  background: #f1ecfb;
  color: #5b3fa6;
}
.tl-event[data-type='Work session'] {
  border-color: #2a8a9a;
  background: #e4f3f5;
  color: #23717d;
}
.tl-event[data-type='Other'] {
  border-color: #8a949c;
  background: #f0f2f4;
  color: #59636d;
}
.tl-body {
  position: relative;
}
.tl-bg {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--label-w);
  pointer-events: none;
}
.tl-weekend {
  position: absolute;
  top: 0;
  bottom: 0;
  background: #f6f7f8;
}
.tl-sprint-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 2px solid var(--team-ink);
}
.tl-event-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 2px dashed #7b5bd6;
}
.tl-event-line[data-type='Work session'] {
  border-left-color: #6fb3bf;
}
.tl-event-line[data-type='Other'] {
  border-left-color: #b7bec5;
}
.tl-today {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: #9db8e8;
}
.tl-today::before {
  position: absolute;
  top: -4px;
  left: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #356fd1;
  content: '';
}
.tl-group {
  position: relative;
  min-height: 38px;
  border-bottom: 1px solid var(--line);
}
/* A subteam's header row. Its name stays at the left edge of the view while the days scroll under it. */
.tl-label {
  position: sticky;
  z-index: 3;
  left: 0;
  display: flex;
  width: max-content;
  max-width: 100%;
  height: 34px;
  padding: 5px 8px 1px;
}
/* "Later": pinned to the right edge of the view. A zero-size sticky anchor holds a strip that fades the chart
   out, with a chip on the row of each task that starts further right. */
.tl-later {
  position: sticky;
  z-index: 4;
  right: 0;
  width: 0;
  height: 0;
  margin-left: auto;
}
.later-strip {
  position: absolute;
  top: 0;
  right: 0;
  background: linear-gradient(to right, rgba(255, 255, 255, 0), #fff 34px);
}
.tl-later-head {
  align-self: stretch;
  order: 2;
}
.tl-later-head .later-strip {
  bottom: 0;
  height: 86px;
}
.tl-later-head span {
  position: absolute;
  bottom: 4px;
  left: 40px;
  color: #59636d;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
.later-chip {
  position: absolute;
  right: 8px;
  left: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: calc(var(--lane-h) - 8px);
  padding: 0 8px;
  border: 1px dashed #c3cad2;
  border-radius: 6px;
  background: #fff;
  color: #3f474e;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
}
.later-chip:hover {
  border-color: var(--team-ink);
  color: var(--team-ink);
}
.later-chip[data-state='In progress'] {
  border-color: #efb064;
}
.later-chip[data-state='Done'] {
  border-color: #a9d5b9;
  color: #4b6656;
}
.later-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.later-date {
  flex: 0 0 auto;
  color: #737d86;
  font-weight: 500;
}
.tl-label button {
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 100%;
  min-width: 0;
  min-height: 28px;
  padding: 0 8px 0 6px;
  border: 0;
  border-radius: 6px;
  /* Readable over the weekend shading and the day lines. */
  background: rgba(255, 255, 255, 0.92);
  font-size: 14px;
  font-weight: 650;
  text-align: left;
}
.tl-label button:hover {
  background: #f3f5f8;
}
.label-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chevron {
  color: #737d86;
  font-size: 11px;
  transition: transform 0.15s ease;
}
.collapsed .chevron {
  transform: rotate(-90deg);
}
.tl-label small {
  color: #98a19e;
  font-size: 13px;
  font-weight: 500;
}
.tl-lanes {
  position: relative;
  flex: 0 0 auto;
}
.tl-bar {
  position: absolute;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 7px;
  height: calc(var(--lane-h) - 8px);
  padding: 0 7px;
  overflow: hidden;
  border: 1px solid;
  border-radius: 6px;
  color: #2c343b;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  /* Grab the middle to move it; the ends (.tl-grip) change one date. A press without a move still opens it. */
  cursor: grab;
  touch-action: pan-x pan-y;
  user-select: none;
  transition: box-shadow 0.15s ease;
}
.tl-bar:hover {
  box-shadow: 0 4px 12px rgba(31, 50, 45, 0.14);
}
.tl-bar.dragging {
  z-index: 5;
  overflow: visible;
  box-shadow: 0 8px 20px rgba(31, 50, 45, 0.24);
  cursor: grabbing;
}
.tl-grip {
  position: absolute;
  top: -1px;
  bottom: -1px;
  z-index: 1;
  width: 7px;
  cursor: ew-resize;
}
.tl-grip[data-edge='start'] {
  left: -1px;
}
.tl-grip[data-edge='end'] {
  right: -1px;
}
/* The dates the bar would get, shown above it while it's dragged. */
.tl-drag-dates {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  padding: 2px 7px;
  border-radius: 5px;
  background: #2c343b;
  color: #fff;
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
  pointer-events: none;
}
.tl-bar:focus-visible {
  outline: 2px solid #82a8e8;
}
.tl-bar[data-state='To do'] {
  border-color: #d3d8de;
  background: #eef0f3;
}
.tl-bar[data-state='In progress'] {
  border-color: #efb064;
  background: #fde6c8;
}
.tl-bar[data-state='Done'] {
  border-color: #a9d5b9;
  background: #dcefe3;
  color: #4b6656;
}
.tl-bar .status-icon {
  width: 14px;
  height: 14px;
  font-size: 8px;
}
/* Initials have no ring and overlap only 3px, so every person's initials stay readable. */
.tl-bar :deep(.avatar) {
  width: 20px;
  height: 20px;
  background: var(--team-soft);
  color: var(--team-ink);
  font-size: 8px;
  box-shadow: none;
}
.tl-bar :deep(.avatar + .avatar) {
  margin-left: -3px;
}
.bar-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Every title starts at the same spot; a long one runs past the bar's right edge instead of being cut off. */
.tl-bar.label-overflows {
  overflow: visible;
}
.tl-bar.label-overflows .bar-title,
.tl-bar.label-overflows .bar-subtasks {
  flex: 0 0 auto;
  overflow: visible;
}
.bar-subtasks {
  flex: 0 0 auto;
  margin-left: auto;
  color: #6c7780;
  font-size: 12px;
  font-weight: 500;
}
.tl-expand {
  position: absolute;
  z-index: 1;
  width: 18px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #6c7780;
  font-size: 11px;
}
.tl-expand::before {
  display: inline-block;
  content: '▶';
  transition: transform 0.15s ease;
}
.tl-expand[aria-expanded='true']::before {
  transform: rotate(90deg);
}
.tl-expand:hover {
  background: #eef1f4;
  color: #303941;
}
.tl-subpanel {
  position: absolute;
  z-index: 2;
  display: grid;
  align-content: start;
  gap: 4px;
  width: max-content;
  padding: 6px 10px 8px 0;
  border: 1px solid var(--line);
  border-top: 3px solid #c9ced3;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(32, 45, 61, 0.1);
}
.tl-subpanel[data-state='In progress'] {
  border-top-color: #efb064;
}
.tl-subpanel[data-state='Done'] {
  border-top-color: #a9d5b9;
}
.tl-sub-row {
  display: flex;
  height: calc(var(--lane-h) - 8px);
}
.tl-bar.tl-sub-bar {
  position: relative;
  flex: 0 0 auto;
}
.sub-note {
  justify-self: start;
  margin-left: 4px;
  padding: 3px 4px;
  border: 0;
  background: transparent;
  color: #737d86;
  font-size: 12px;
}
.empty {
  margin: 16px var(--label-w);
  padding-left: 12px;
  color: var(--muted);
  font-size: 13px;
}
</style>

<style>
/* Status icons (Timeline bars, the legend): a circle, half-filled for In progress, a check for Done. */
.status-icon {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1.5px solid #9aa0a6;
  border-radius: 50%;
  background: #fff;
  color: transparent;
  font-size: 9px;
  line-height: 1;
}
.status-icon::after {
  content: '✓';
}
.status-icon[data-state='In progress'] {
  border-color: #e49332;
  background: linear-gradient(90deg, #e49332 50%, #fff 50%);
}
.status-icon[data-state='Done'] {
  border-color: #35a267;
  background: #35a267;
  color: #fff;
}
</style>
