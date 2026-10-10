<script setup lang="ts">
// The assignee editor for a table cell: the assignee picker in a popover. Saves as you go; click away or Esc closes.
import { ref } from 'vue'
import { useClickAway } from '@/composables/usePopover'
import AssigneePicker, { type Person } from '@/components/ui/AssigneePicker.vue'
import FloatingPanel from '@/components/ui/FloatingPanel.vue'

const props = defineProps<{
  anchor: HTMLElement | null
  ids: readonly string[]
  people: readonly Person[]
  label: string
}>()
const emit = defineEmits<{ change: [ids: string[]]; close: [] }>()

const panel = ref<InstanceType<typeof FloatingPanel> | null>(null)
useClickAway(
  () => [panel.value?.element, props.anchor],
  () => emit('close'),
)
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    emit('close')
    props.anchor?.focus()
  }
}
</script>

<template>
  <FloatingPanel
    ref="panel"
    class="assignee-popover"
    :anchor="anchor"
    :match-width="260"
    autofocus=".assignee-search"
    @keydown="onKeydown"
  >
    <AssigneePicker
      :model-value="ids"
      :people="people"
      :label="label"
      @update:model-value="emit('change', $event)"
    />
  </FloatingPanel>
</template>

<style>
.assignee-popover {
  z-index: 55;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  box-shadow: var(--shadow);
}
</style>
