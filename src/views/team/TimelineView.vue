<script setup lang="ts">
// Timeline: the season's days across, tasks grouped by subteam (a task with several sits in its first; "No subteam"
// last), dense 34px lanes. Bar color + icon = status. Solid lines only at sprint boundaries; event days are dashed
// (competitions purple, work sessions teal, other gray). Opens on the current sprint's first day unless today would
// be off-screen. Titles too long for their bar run past its right edge, and lanes leave room so they never overlap.
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { writes } from '@/data'
import { todayIso } from '@/model/dates'
import type { Status, Subtask, Task, WithId } from '@/model/types'
import { useTaskView } from '@/composables/useTaskView'
import { EVENT_ICONS, useEvents } from '@/composables/useEvents'
import { useClickAway } from '@/composables/usePopover'
import { useTaskPanel } from '@/stores/taskPanel'
import { useToast } from '@/stores/toast'
import { formatEventDate, formatShortDate, plural } from '@/ui/format'
import {
  TIMELINE_ZOOMS,
  barWidth,
  contentWidth,
  dateSpan,
  daysBetween,
  overflowDays,
  packLanes,
  shiftIsoDate,
  timelineRange,
} from '@/ui/timeline'
import { updateSubtask } from '@/model/subtasks'
import AnnouncementBanner from '@/components/tasks/AnnouncementBanner.vue'
import SprintHeader from '@/components/tasks/SprintHeader.vue'
import TaskFilterBar from '@/components/tasks/TaskFilterBar.vue'
import AvatarStack from '@/components/ui/AvatarStack.vue'

const LABEL_W = 220
const LANE_H = 34
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

// ---------- measuring titles (bar font) ----------
const context = document.createElement('canvas').getContext('2d')
const fontFamily = getComputedStyle(document.body).fontFamily
function textWidth(text: string) {
  if (!context) return text.length * 7
  context.font = `600 12px ${fontFamily}`
  return context.measureText(text).width
}
const activeSubtasks = (task: Task) => task.subtasks.filter((item) => !item.archived)
function overflowPx(title: string, people: number, span: [string, string], subtaskCount: boolean) {
  return Math.max(
    0,
    contentWidth(textWidth(title), people, subtaskCount) - barWidth(span, dayWidth.value),
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
  packStart: string
  packEnd: string
  overflow: number
}
const groups = computed(() => {
  const order = [
    ...team.subteams.value.map((s) => ({ id: s.id, name: s.name })),
    { id: '', name: 'No subteam' },
  ]
  return order
    .map(({ id, name }) => {
      const items: Item[] = visible.value
        .filter(
          (task) =>
            (task.subteamIds.find((sid) => team.subteams.value.some((s) => s.id === sid)) ?? '') ===
            id,
        )
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
          const overflow = overflowPx(task.title, task.assigneeIds.length, span, subs.length > 0)
          const ends = [reach[1], shiftIsoDate(span[1], overflowDays(overflow, dayWidth.value))]
          if (isOpen)
            dated.forEach((d) =>
              ends.push(
                shiftIsoDate(
                  d.span[1],
                  overflowDays(
                    overflowPx(d.subtask.title, d.subtask.assigneeIds.length, d.span, false),
                    dayWidth.value,
                  ),
                ),
              ),
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
              // A free day before tasks with subtasks leaves room for the expand arrow.
              packStart: expandable ? shiftIsoDate(reach[0], -1) : reach[0],
              packEnd: ends.sort().at(-1)!,
              overflow,
            },
          ]
        })
      const { lanes, count } = packLanes(items)
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
        id,
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
function toggleDone(task: WithId<Task>) {
  writes
    .updateTask(team.teamId.value!, task.id, { status: task.status === 'Done' ? 'To do' : 'Done' })
    .catch(fail)
}
function toggleSubDone(task: WithId<Task>, subtask: Subtask) {
  const status: Status = subtask.status === 'Done' ? 'To do' : 'Done'
  writes
    .updateTask(team.teamId.value!, task.id, {
      subtasks: updateSubtask(task.subtasks, subtask.id, { status }),
    })
    .catch(fail)
}
function toggleSet(which: 'collapsed' | 'expanded', id: string) {
  const set = which === 'collapsed' ? collapsed : expanded
  const next = new Set(set.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  set.value = next
}
function addTask() {
  const shown = sprint.value
  panel.create(
    team.teamId.value!,
    shown && shown !== 'all' ? shown.id : (team.currentSprint.value?.id ?? null),
  )
}
const barTitle = (title: string, status: string, span: [string, string]) =>
  `${title} · ${status} · ${formatShortDate(span[0])}${span[0] === span[1] ? '' : ` – ${formatShortDate(span[1])}`}`

// ---------- No date menu ----------
const noDateOpen = ref(false)
const noDateRoot = ref<HTMLElement | null>(null)
useClickAway(
  () => [noDateRoot.value],
  () => (noDateOpen.value = false),
)

// ---------- scrolling and zoom ----------
const scroller = ref<HTMLElement | null>(null)
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

    <div ref="scroller" class="timeline-scroll">
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
          <div class="tl-corner" />
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
            <div class="tl-label">
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
                    :class="{ 'label-overflows': item.overflow > 0 }"
                    :data-state="item.task.status"
                    role="button"
                    tabindex="0"
                    :title="barTitle(item.task.title, item.task.status, item.span)"
                    :style="{
                      left: `${x(item.span[0]) + 2}px`,
                      width: `${barWidth(item.span, dayWidth)}px`,
                      top: `${item.top}px`,
                    }"
                    @click="panel.open(team.teamId.value!, item.task.id)"
                    @keydown.enter.prevent="panel.open(team.teamId.value!, item.task.id)"
                  >
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
                        :title="barTitle(d.subtask.title, d.subtask.status, d.span)"
                        :style="{
                          width: `${barWidth(d.span, dayWidth)}px`,
                          marginRight: `${overflowPx(d.subtask.title, d.subtask.assigneeIds.length, d.span, false) + 10}px`,
                        }"
                        @click="panel.open(team.teamId.value!, item.task.id, d.subtask.id)"
                        @keydown.enter.prevent="
                          panel.open(team.teamId.value!, item.task.id, d.subtask.id)
                        "
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
.tl-corner {
  position: sticky;
  z-index: 4;
  left: 0;
  flex: 0 0 var(--label-w);
  border-right: 1px solid var(--line);
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
  display: flex;
  min-height: 38px;
  border-bottom: 1px solid var(--line);
}
.tl-label {
  position: sticky;
  z-index: 3;
  left: 0;
  display: flex;
  align-items: flex-start;
  flex: 0 0 var(--label-w);
  min-width: 0;
  overflow: hidden;
  padding: 3px 8px;
  border-right: 1px solid var(--line);
  background: #fff;
}
.tl-label button {
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 100%;
  min-width: 0;
  min-height: 28px;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
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
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}
.tl-bar:hover {
  box-shadow: 0 4px 12px rgba(31, 50, 45, 0.14);
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
