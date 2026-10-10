<script setup lang="ts">
// The ⠿ handle on List and Planning rows and on subtasks: Move to top / up / down / bottom. (Order is priority.)
// Rows also move with Alt+↑ / Alt+↓ (see altMove). Shown on hover or focus.
import { ref } from 'vue'
import ChoiceMenu from './ChoiceMenu.vue'

const props = defineProps<{ index: number; count: number; label: string }>()
const emit = defineEmits<{ move: [to: number] }>()

const button = ref<HTMLButtonElement | null>(null)
const open = ref(false)
type Where = 'top' | 'up' | 'down' | 'bottom'
const target: Record<Where, () => number> = {
  top: () => 0,
  up: () => props.index - 1,
  down: () => props.index + 1,
  bottom: () => props.count - 1,
}
</script>

<template>
  <button
    ref="button"
    type="button"
    class="rank-handle"
    :aria-label="`Reorder ${label}`"
    aria-haspopup="menu"
    aria-expanded="false"
    title="Reorder (Alt+↑ / Alt+↓)"
    @click.stop="open = !open"
  >
    ⠿
  </button>
  <ChoiceMenu
    v-if="open"
    :anchor="button"
    heading="Move"
    :options="[
      { value: 'top', label: 'Move to top', disabled: index === 0, meta: '' },
      { value: 'up', label: 'Move up', disabled: index === 0, meta: 'Alt+↑' },
      { value: 'down', label: 'Move down', disabled: index >= count - 1, meta: 'Alt+↓' },
      { value: 'bottom', label: 'Move to bottom', disabled: index >= count - 1, meta: '' },
    ]"
    @pick="emit('move', target[$event as Where]())"
    @close="open = false"
  />
</template>

<style>
.rank-handle {
  width: 18px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #8a949c;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
}
.rank-handle:hover {
  background: #eef1f4;
  color: #4d5962;
}
tr:hover .rank-handle,
tr:focus-within .rank-handle,
.rank-handle:focus-visible,
.rank-handle[aria-expanded='true'] {
  opacity: 1;
}
@media (hover: none) {
  .rank-handle {
    opacity: 1;
  }
}
</style>
