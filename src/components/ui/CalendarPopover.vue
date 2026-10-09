<script setup lang="ts">
// A small month calendar anchored under a date (ported from the mock-up's openCalendar): due dates, start dates,
// sprint dates. Arrow keys move by a day or a week, Enter picks, Esc or a click away closes. The parent decides
// whether a pick closes it (most fields) or keeps it open (a sprint's start, then its end).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { todayIso } from '@/model/dates'
import { calendarMonth, moveDay, shiftMonth } from '@/ui/calendar'
import { formatEventDate } from '@/ui/format'
import { useAnchoredPosition, useClickAway } from '@/composables/usePopover'

const props = defineProps<{
  anchor: HTMLElement | null
  label: string
  selected: string | null
  /** Shaded days, e.g. the task's sprint. */
  range?: { start: string; end: string; name?: string } | null
  min?: string | null
  max?: string | null
  note?: string
  /** Buttons along the bottom, e.g. "Clear date". */
  actions?: readonly { label: string; run: () => void }[]
}>()
const emit = defineEmits<{ pick: [iso: string]; close: [] }>()

const popover = ref<HTMLElement | null>(null)
const { style, place } = useAnchoredPosition(() => props.anchor, popover)
const focus = ref(props.selected ?? todayIso())
const month = ref(focus.value.slice(0, 7))
const grid = computed(() => calendarMonth(month.value))
const today = todayIso()

const disabled = (iso: string) =>
  (!!props.min && iso < props.min) || (!!props.max && iso > props.max)
const inRange = (iso: string) => !!props.range && iso >= props.range.start && iso <= props.range.end
// If the focus day isn't in this month (after paging), Tab lands on the first day you can pick.
const tabStop = computed(() =>
  grid.value.days.includes(focus.value)
    ? focus.value
    : grid.value.days.find((iso) => !disabled(iso)),
)

async function focusDay() {
  await nextTick()
  popover.value
    ?.querySelector<HTMLElement>(`[data-day="${tabStop.value}"]`)
    ?.focus({ preventScroll: true })
}

function close(returnFocus = false) {
  emit('close')
  if (returnFocus) props.anchor?.focus()
}

function pick(iso: string) {
  focus.value = iso
  emit('pick', iso)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close(true)
    return
  }
  const day = (event.target as HTMLElement).dataset?.day
  const next = day ? moveDay(day, event.key) : null
  if (!next) return
  event.preventDefault()
  focus.value = next
  month.value = next.slice(0, 7)
  void focusDay()
}

function step(delta: number) {
  month.value = shiftMonth(month.value, delta)
}

// A pick that keeps the calendar open (e.g. sprint start → end) moves to the new date.
watch(
  () => props.selected,
  (iso) => {
    if (iso) {
      focus.value = iso
      month.value = iso.slice(0, 7)
    }
  },
)
watch(month, () => nextTick(place))

useClickAway(
  () => [popover.value, props.anchor],
  () => close(),
)
onMounted(() => {
  props.anchor?.setAttribute('aria-expanded', 'true')
  void focusDay()
})
onBeforeUnmount(() => props.anchor?.setAttribute('aria-expanded', 'false'))
</script>

<template>
  <Teleport to="body">
    <div
      ref="popover"
      class="calendar"
      role="dialog"
      :aria-label="label"
      :style="style"
      @keydown="onKeydown"
    >
      <div class="calendar-head">
        <button type="button" aria-label="Previous month" @click="step(-1)">‹</button>
        <strong>{{ grid.title }}</strong>
        <button type="button" aria-label="Next month" @click="step(1)">›</button>
      </div>
      <div class="calendar-grid" role="grid">
        <span
          v-for="(letter, i) in ['S', 'M', 'T', 'W', 'T', 'F', 'S']"
          :key="i"
          aria-hidden="true"
          >{{ letter }}</span
        >
        <i v-for="blank in grid.leading" :key="`blank-${blank}`" />
        <button
          v-for="iso in grid.days"
          :key="iso"
          type="button"
          class="day"
          :class="{
            'in-range': inRange(iso),
            'range-start': range && iso === range.start,
            'range-end': range && iso === range.end,
            selected: iso === selected,
            today: iso === today,
          }"
          :data-day="iso"
          :tabindex="iso === tabStop ? 0 : -1"
          :disabled="disabled(iso)"
          :aria-pressed="iso === selected"
          :aria-label="`${formatEventDate(iso)}${inRange(iso) && range?.name ? `, in ${range.name}` : ''}`"
          @click="pick(iso)"
        >
          {{ Number(iso.slice(8)) }}
        </button>
      </div>
      <p v-if="note" class="calendar-note">{{ note }}</p>
      <div v-if="actions?.length" class="calendar-foot">
        <button
          v-for="action in actions"
          :key="action.label"
          type="button"
          @click="(close(true), action.run())"
        >
          {{ action.label }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.calendar {
  position: fixed;
  z-index: 40;
  width: 244px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  box-shadow: var(--shadow);
  font-size: 12px;
}
.calendar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.calendar-head strong {
  font-size: 13px;
}
.calendar-head button {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #59636d;
  font-size: 15px;
}
.calendar-head button:hover {
  background: #f1f4f8;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 2px;
}
.calendar-grid > span {
  padding: 4px 0;
  color: #8a949c;
  font-size: 11px;
  text-align: center;
}
.day {
  height: 30px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2c343b;
  font: inherit;
  font-variant-numeric: tabular-nums;
}
.day:hover:not(:disabled) {
  border-radius: 6px;
  background: #f1f4f8;
}
.day.in-range {
  background: var(--team-soft);
  color: var(--team-ink);
}
.day.range-start {
  border-radius: 6px 0 0 6px;
}
.day.range-end {
  border-radius: 0 6px 6px 0;
}
.day.range-start.range-end {
  border-radius: 6px;
}
.day.selected {
  border-radius: 6px;
  background: var(--team-ink);
  color: #fff;
  font-weight: 700;
}
.day.today {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.day:disabled {
  color: #c3c9ce;
  cursor: default;
}
.day:focus-visible {
  outline: 2px solid #82a8e8;
  outline-offset: -2px;
}
.calendar-note {
  margin: 6px 2px 0;
  color: #737d86;
  font-size: 11px;
}
.calendar-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--line);
}
.calendar-foot button {
  padding: 4px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #59636d;
  font-size: 12px;
}
.calendar-foot button:hover {
  background: #f1f4f8;
  color: #a43d34;
}
</style>
