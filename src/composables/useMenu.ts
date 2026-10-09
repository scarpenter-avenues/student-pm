// A dropdown menu's open state and keyboard behavior: click away or Esc closes (focus returns to the button),
// ↑/↓ move between items, and the current item (or the first) is focused on open.
import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

export function useMenu(root: Ref<HTMLElement | null>, trigger: Ref<HTMLElement | null>) {
  const open = ref(false)
  const items = () => [...(root.value?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]

  function onPointerDown(event: PointerEvent) {
    if (!root.value?.contains(event.target as Node)) open.value = false
  }

  watch(open, async (isOpen) => {
    if (!isOpen) {
      document.removeEventListener('pointerdown', onPointerDown)
      return
    }
    document.addEventListener('pointerdown', onPointerDown)
    await nextTick()
    const list = items()
    ;(list.find((item) => item.getAttribute('aria-current')) ?? list[0])?.focus()
  })
  onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))

  function onKeydown(event: KeyboardEvent) {
    if (!open.value) return
    const list = items()
    const index = list.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      open.value = false
      trigger.value?.focus()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      list[(index + step + list.length) % list.length]?.focus()
    }
  }

  return {
    open,
    toggle: () => (open.value = !open.value),
    close: () => (open.value = false),
    onKeydown,
  }
}
