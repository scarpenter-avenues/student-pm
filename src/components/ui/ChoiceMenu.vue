<script setup lang="ts" generic="V extends string | null">
// A small menu anchored to a button or table cell (ported from the mock-up's openChoiceMenu).
// Single: picking an item emits `pick` and closes. Multiple (subteams): items toggle, and `change` fires once when
// the menu closes, if anything changed; Esc cancels. Render chips through the #option slot so the menu shows the
// same chips as the table.
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { moveFocus, useAnchoredPosition, useClickAway } from '@/composables/usePopover'

export interface ChoiceOption<T> {
  value: T
  label: string
  disabled?: boolean
  /** Right-hand note, e.g. "Here now" or a date range. A ✓ marks the current value when there's none. */
  meta?: string
}

const props = withDefaults(
  defineProps<{
    anchor: HTMLElement | null
    options: readonly ChoiceOption<V>[]
    /** The current value (single) or values (multiple). */
    selected?: V | readonly V[]
    multiple?: boolean
    heading?: string
    align?: 'left' | 'right'
  }>(),
  { selected: undefined, multiple: false, heading: undefined, align: 'left' },
)
const emit = defineEmits<{
  pick: [value: V]
  change: [values: V[]]
  close: []
}>()

const menu = ref<HTMLElement | null>(null)
const { style } = useAnchoredPosition(() => props.anchor, menu, { align: props.align })

const initial = (): V[] =>
  props.selected === undefined
    ? []
    : Array.isArray(props.selected)
      ? [...props.selected]
      : [props.selected as V]
const picked = shallowRef<V[]>(initial())
let cancelled = false

const isPicked = (value: V) => picked.value.includes(value)

function choose(option: ChoiceOption<V>) {
  if (option.disabled) return
  if (props.multiple) {
    picked.value = isPicked(option.value)
      ? picked.value.filter((value) => value !== option.value)
      : [...picked.value, option.value]
    return
  }
  if (!isPicked(option.value)) emit('pick', option.value)
  close(true)
}

function close(returnFocus = false) {
  emit('close')
  if (returnFocus) props.anchor?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    cancelled = true
    close(true)
    return
  }
  moveFocus(menu.value, 'button:not(:disabled)', event)
}

// The anchor counts as inside, so clicking it again toggles the menu instead of reopening it.
useClickAway(
  () => [menu.value, props.anchor],
  () => close(),
)

onMounted(async () => {
  props.anchor?.setAttribute('aria-expanded', 'true')
  await nextTick()
  const items = [...(menu.value?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])]
  ;(items.find((item) => item.dataset.picked === 'true') ?? items[0])?.focus({
    preventScroll: true,
  })
})
onBeforeUnmount(() => {
  props.anchor?.setAttribute('aria-expanded', 'false')
  if (!props.multiple || cancelled) return
  const before = initial()
  const after = props.options
    .map((option) => option.value)
    .filter((value) => picked.value.includes(value))
  const changed = before.length !== after.length || before.some((value) => !after.includes(value))
  if (changed) emit('change', after)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="menu"
      class="choice-menu"
      role="menu"
      :aria-multiselectable="multiple || undefined"
      :style="style"
      @keydown="onKeydown"
    >
      <p v-if="heading" class="choice-heading">{{ heading }}</p>
      <button
        v-for="option in options"
        :key="String(option.value)"
        type="button"
        :role="multiple ? 'menuitemcheckbox' : 'menuitem'"
        :aria-checked="multiple ? isPicked(option.value) : undefined"
        :data-picked="isPicked(option.value)"
        :disabled="option.disabled"
        @click="choose(option)"
      >
        <slot name="option" :option="option">
          <span>{{ option.label }}</span>
        </slot>
        <small>{{ option.meta ?? (isPicked(option.value) ? '✓' : '') }}</small>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.choice-menu {
  position: fixed;
  z-index: 40;
  display: grid;
  min-width: 200px;
  max-height: 320px;
  padding: 6px;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  box-shadow: var(--shadow);
}
.choice-heading {
  margin: 2px 8px 6px;
  color: #737d86;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #2c343b;
  font-size: 13px;
  text-align: left;
}
button:hover:not(:disabled),
button:focus-visible {
  background: var(--team-softer);
  color: var(--team-ink);
  outline: none;
}
button:disabled {
  color: #9aa3aa;
  cursor: default;
}
small {
  color: #8a949c;
  font-size: 11px;
  white-space: nowrap;
}
</style>
