<script setup lang="ts">
// A filter dropdown with a checklist (ported from mountMultiFilter). Nothing ticked, or everything ticked, means no
// filter, shown as `allLabel` ("Any status"). Unlike TeamPicker, each tick applies at once.
import { ref } from 'vue'
import { useClickAway } from '@/composables/usePopover'
import FloatingPanel from './FloatingPanel.vue'

// Attributes (class, data-*) go on the button; the popover is a second root.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: readonly string[]
  options: readonly string[]
  label: string
  allLabel: string
}>()
const emit = defineEmits<{ 'update:modelValue': [values: string[]] }>()

const button = ref<HTMLButtonElement | null>(null)
const panel = ref<InstanceType<typeof FloatingPanel> | null>(null)
const open = ref(false)

function set(values: string[]) {
  // Everything ticked is the same as no filter.
  emit('update:modelValue', values.length === props.options.length ? [] : values)
}
function toggle(value: string, on: boolean) {
  set(props.options.filter((option) => (option === value ? on : props.modelValue.includes(option))))
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
    button.value?.focus()
  }
}
useClickAway(
  () => [button.value, panel.value?.element],
  () => (open.value = false),
)
</script>

<template>
  <button
    v-bind="$attrs"
    ref="button"
    type="button"
    class="check-button"
    :aria-label="label"
    aria-haspopup="true"
    :aria-expanded="open"
    @click="open = !open"
    @keydown="onKeydown"
  >
    {{ modelValue.length ? modelValue.join(', ') : allLabel }}
  </button>
  <FloatingPanel
    v-if="open"
    ref="panel"
    :anchor="button"
    class="check-menu"
    autofocus="input:checked, input"
    @keydown="onKeydown"
  >
    <label v-for="option in options" :key="option">
      <input
        type="checkbox"
        :checked="modelValue.includes(option)"
        @change="toggle(option, ($event.target as HTMLInputElement).checked)"
      />
      {{ option }}
    </label>
    <button type="button" class="text-button check-clear" @click="set([])">
      Show {{ allLabel.toLowerCase() }}
    </button>
  </FloatingPanel>
</template>

<style>
.check-clear {
  justify-self: start;
  margin: 2px 6px 0;
  font-size: 12px;
}
</style>
