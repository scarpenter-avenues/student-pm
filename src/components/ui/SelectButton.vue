<script setup lang="ts" generic="V extends string | null">
// A themed stand-in for <select> (no native selects in the app): a button showing the value, opening a ChoiceMenu.
// With `multiple`, the value is a list and changes apply when the menu closes.
import { ref } from 'vue'
import ChoiceMenu, { type ChoiceOption } from './ChoiceMenu.vue'

// Attributes (class, data-*) go on the button; the popover is a second root.
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue: V | V[]
    options: readonly ChoiceOption<V>[]
    multiple?: boolean
    label: string
    disabled?: boolean
    /** Shown when nothing is chosen. */
    placeholder?: string
  }>(),
  { multiple: false, disabled: false, placeholder: '—' },
)
const emit = defineEmits<{ 'update:modelValue': [value: V | V[]] }>()

const button = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const empty = () =>
  Array.isArray(props.modelValue)
    ? !props.modelValue.length
    : props.modelValue === null || props.modelValue === ''
</script>

<template>
  <button
    v-bind="$attrs"
    ref="button"
    type="button"
    class="field-button"
    :class="{ empty: empty() }"
    :aria-label="label"
    aria-haspopup="menu"
    aria-expanded="false"
    :disabled="disabled"
    @click="open = !open"
  >
    <span v-if="empty()">{{ placeholder }}</span>
    <slot v-else name="value" :value="modelValue">{{ modelValue }}</slot>
  </button>
  <ChoiceMenu
    v-if="open"
    :anchor="button"
    :options="options"
    :selected="modelValue"
    :multiple="multiple"
    @pick="emit('update:modelValue', $event)"
    @change="emit('update:modelValue', $event)"
    @close="open = false"
  >
    <template #option="{ option }">
      <slot name="option" :option="option">
        <span>{{ option.label }}</span>
      </slot>
    </template>
  </ChoiceMenu>
</template>
