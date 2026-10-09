// The toast at the bottom right: a short confirmation, optionally with one action (e.g. Undo after archiving).
// Toasts with an action stay up longer.
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export interface Toast {
  id: number
  message: string
  action?: { label: string; run: () => void }
}

export const useToast = defineStore('toast', () => {
  const current = shallowRef<Toast | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let next = 1

  function show(message: string, action?: Toast['action']) {
    clearTimeout(timer)
    current.value = { id: next++, message, action }
    timer = setTimeout(dismiss, action ? 6000 : 2300)
  }
  function dismiss() {
    clearTimeout(timer)
    current.value = null
  }
  function runAction() {
    const action = current.value?.action
    dismiss()
    action?.run()
  }
  return { current, show, dismiss, runAction }
})
