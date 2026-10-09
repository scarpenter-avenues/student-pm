<script setup lang="ts">
// Anything that floats under an anchor: teleported to <body>, placed below (or above when there's no room).
import { nextTick, onMounted, ref } from 'vue'
import { useAnchoredPosition } from '@/composables/usePopover'

// class, role, id, and listeners go to the panel itself (the root is a Teleport).
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    anchor: HTMLElement | null
    tag?: string
    align?: 'left' | 'right'
    /** At least the anchor's width (and this many pixels). */
    matchWidth?: number
    /** Focus the first element matching this selector when it opens (e.g. 'input:checked, input'). */
    autofocus?: string
  }>(),
  { tag: 'div', align: 'left', matchWidth: 0, autofocus: undefined },
)

const panel = ref<HTMLElement | null>(null)
const minWidth = props.matchWidth
  ? Math.max(props.anchor?.getBoundingClientRect().width ?? 0, props.matchWidth)
  : 0
const { style, place } = useAnchoredPosition(() => props.anchor, panel, {
  align: props.align,
  minWidth,
})
onMounted(async () => {
  if (!props.autofocus) return
  await nextTick()
  const selectors = props.autofocus.split(',').map((selector) => selector.trim())
  for (const selector of selectors) {
    const target = panel.value?.querySelector<HTMLElement>(selector)
    if (target) return target.focus({ preventScroll: true })
  }
})
defineExpose({ place, element: panel })
</script>

<template>
  <Teleport to="body">
    <component :is="tag" ref="panel" v-bind="$attrs" class="floating-panel" :style="style">
      <slot />
    </component>
  </Teleport>
</template>

<style scoped>
.floating-panel {
  position: fixed;
}
</style>
