<script setup lang="ts">
import { useToast } from '@/stores/toast'

const toast = useToast()
</script>

<template>
  <Transition name="toast">
    <div
      v-if="toast.current"
      :key="toast.current.id"
      class="toast"
      :class="{ 'has-action': toast.current.action }"
      role="status"
      aria-live="polite"
    >
      {{ toast.current.message }}
      <button
        v-if="toast.current.action"
        type="button"
        class="toast-action"
        @click="toast.runAction()"
      >
        {{ toast.current.action.label }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: calc(100vw - 40px);
  padding: 11px 14px;
  border-radius: 7px;
  background: #263a34;
  color: white;
  box-shadow: var(--shadow);
  font-size: 14px;
}
.toast-action {
  padding: 2px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #9fd8ff;
  font: inherit;
  font-weight: 700;
}
.toast-action:hover {
  background: rgba(255, 255, 255, 0.12);
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
@media (max-width: 680px) {
  .toast {
    right: 12px;
    bottom: 12px;
    left: 12px;
  }
}
</style>
