<script setup lang="ts">
// A date field you pick, never type: a themed button that opens the calendar, with "Clear date".
import { ref } from 'vue'
import { formatShortDate } from '@/ui/format'
import CalendarPopover from './CalendarPopover.vue'

// Attributes (class, data-*) go on the button; the popover is a second root.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue: string | null
    label: string
    /** Shown when there's no date, e.g. "Due date". */
    placeholder?: string
    min?: string | null
    max?: string | null
    range?: { start: string; end: string; name?: string } | null
    clearable?: boolean
    disabled?: boolean
  }>(),
  { placeholder: 'No date', min: null, max: null, range: null, clearable: true, disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [iso: string | null] }>()

const button = ref<HTMLButtonElement | null>(null)
const open = ref(false)

function pick(iso: string) {
  open.value = false
  if (iso !== props.modelValue) emit('update:modelValue', iso)
  button.value?.focus()
}
</script>

<template>
  <button
    v-bind="$attrs"
    ref="button"
    type="button"
    class="field-button"
    :class="{ empty: !modelValue }"
    :aria-label="modelValue ? `${label}: ${formatShortDate(modelValue)}` : label"
    aria-haspopup="dialog"
    aria-expanded="false"
    :disabled="disabled"
    @click="open = !open"
  >
    {{ modelValue ? formatShortDate(modelValue) : placeholder }}
  </button>
  <CalendarPopover
    v-if="open"
    :anchor="button"
    :label="label"
    :selected="modelValue"
    :range="range"
    :min="min"
    :max="max"
    :actions="
      clearable && modelValue
        ? [{ label: 'Clear date', run: () => emit('update:modelValue', null) }]
        : []
    "
    @pick="pick"
    @close="open = false"
  />
</template>
