<script setup lang="ts">
// A task title that renames in place: click it, then Enter or click away saves, Esc cancels. The Open button
// (shown on hover) opens the side panel. Used in every task table and card except the Timeline.
import { nextTick, ref } from 'vue'

const props = withDefaults(defineProps<{ title: string; maxLength?: number; open?: boolean }>(), {
  maxLength: 90,
  open: true,
})
const emit = defineEmits<{ save: [title: string]; open: [] }>()

const editing = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)

async function start() {
  draft.value = props.title
  editing.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

async function finish(keep: boolean) {
  if (!editing.value) return
  editing.value = false
  const next = draft.value.replace(/\s+/g, ' ').trim()
  if (keep && next && next !== props.title) emit('save', next)
  else {
    await nextTick()
    button.value?.focus()
  }
}

function onKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key === 'Enter') {
    event.preventDefault()
    void finish(true)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    void finish(false)
  }
}
</script>

<template>
  <span class="editable-title" :class="{ editing }">
    <input
      v-if="editing"
      ref="input"
      v-model="draft"
      class="title-input"
      :maxlength="maxLength"
      aria-label="Task name"
      @click.stop
      @keydown="onKeydown"
      @blur="finish(true)"
    />
    <template v-else>
      <button
        ref="button"
        type="button"
        class="title-button"
        title="Click to rename"
        @click.stop="start"
      >
        {{ title }}
      </button>
      <button
        v-if="open"
        type="button"
        class="row-open"
        :aria-label="`Open ${title} in the side panel`"
        @click.stop="emit('open')"
      >
        Open
      </button>
    </template>
  </span>
</template>

<style scoped>
.editable-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
}
.title-button {
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}
.title-button:hover {
  text-decoration: underline;
  text-decoration-color: #c3c9ce;
  text-underline-offset: 3px;
}
.title-input {
  width: 100%;
  min-width: 120px;
  max-width: 420px;
  height: 26px;
  padding: 2px 6px;
  border: 1px solid #82a8e8;
  border-radius: 4px;
  background: #fff;
  color: #202124;
  font: inherit;
}
</style>
