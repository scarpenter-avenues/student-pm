// Floating things (menus, the calendar, the assignee list) anchored to a button or cell. They're teleported to
// <body> with position: fixed, open below the anchor (above when there's no room), and stay inside the window.
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export function useAnchoredPosition(
  anchor: () => HTMLElement | null | undefined,
  floating: Ref<HTMLElement | null>,
  { align = 'left', minWidth = 0 }: { align?: 'left' | 'right'; minWidth?: number } = {},
) {
  // Hidden until measured, so it never flashes at the corner.
  const style = ref<Record<string, string>>({ visibility: 'hidden', top: '0px', left: '0px' })

  function place() {
    const target = anchor()
    const element = floating.value
    if (!target || !element) return
    const rect = target.getBoundingClientRect()
    const width = Math.max(element.offsetWidth, minWidth)
    const height = element.offsetHeight
    const roomBelow = window.innerHeight - rect.bottom
    const top =
      roomBelow < height + 12 && rect.top > height + 12 ? rect.top - height - 4 : rect.bottom + 4
    const wanted = align === 'right' ? rect.right - width : rect.left
    const left = Math.max(8, Math.min(wanted, window.innerWidth - width - 8))
    style.value = {
      top: `${Math.max(8, top)}px`,
      left: `${left}px`,
      ...(minWidth ? { minWidth: `${minWidth}px` } : {}),
    }
  }

  onMounted(() => {
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', place)
    window.removeEventListener('scroll', place, true)
  })
  return { style, place }
}

/** Calls `dismiss` on a pointer press outside every element `inside()` returns (e.g. the popover and its anchor). */
export function useClickAway(inside: () => (Element | null | undefined)[], dismiss: () => void) {
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Node
    if (!inside().some((element) => element?.contains(target))) dismiss()
  }
  onMounted(() => document.addEventListener('pointerdown', onPointerDown, true))
  onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true))
}

/** ↑/↓ move focus between `selector` items inside `root`, wrapping around. Returns true if it handled the key. */
export function moveFocus(
  root: HTMLElement | null,
  selector: string,
  event: KeyboardEvent,
): boolean {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false
  const items = [...(root?.querySelectorAll<HTMLElement>(selector) ?? [])]
  if (!items.length) return false
  event.preventDefault()
  const index = items.indexOf(document.activeElement as HTMLElement)
  const step = event.key === 'ArrowDown' ? 1 : -1
  items[(index + step + items.length) % items.length]?.focus()
  return true
}
