<script setup lang="ts">
// Several assignees as chips, added by typing to filter the team's roster (ported from createAssigneePicker).
// ↑/↓ and Enter pick, Backspace removes the last chip. No emails, no inviting from here.
import { computed, ref } from 'vue'
import { initials } from '@/ui/format'
import FloatingPanel from './FloatingPanel.vue'

export interface Person {
  id: string
  displayName: string
}

const props = withDefaults(
  defineProps<{
    modelValue: readonly string[]
    /** Everyone who can be assigned (the team roster). */
    people: readonly Person[]
    label?: string
    placeholder?: string
  }>(),
  { label: 'Assignees', placeholder: 'Add a person…' },
)
const emit = defineEmits<{ 'update:modelValue': [ids: string[]] }>()

const root = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const query = ref('')
const open = ref(false)
const active = ref(0)
const listId = `assignee-list-${Math.random().toString(36).slice(2, 8)}`

const byId = computed(() => new Map(props.people.map((person) => [person.id, person])))
const chosen = computed(() =>
  props.modelValue.map((id) => byId.value.get(id) ?? { id, displayName: 'Former member' }),
)
/** Unpicked people matching the search; names that start with it come first. */
const matches = computed(() => {
  const text = query.value.trim().toLowerCase()
  return props.people
    .filter((person) => !props.modelValue.includes(person.id))
    .filter((person) => !text || person.displayName.toLowerCase().includes(text))
    .sort(
      (a, b) =>
        Number(!a.displayName.toLowerCase().startsWith(text)) -
        Number(!b.displayName.toLowerCase().startsWith(text)),
    )
})

function add(person: Person | undefined) {
  if (!person) return
  emit('update:modelValue', [...props.modelValue, person.id])
  query.value = ''
  active.value = 0
}
function remove(id: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((other) => other !== id),
  )
  input.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  const count = Math.max(1, matches.value.length)
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    open.value = true
    active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
  } else if (event.key === 'Enter' && query.value.trim() && matches.value.length) {
    event.preventDefault()
    event.stopPropagation()
    add(matches.value[active.value])
  } else if (event.key === 'Backspace' && !query.value && props.modelValue.length) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  } else if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
  }
}

// The match text in bold.
function parts(name: string) {
  const text = query.value.trim()
  const at = text ? name.toLowerCase().indexOf(text.toLowerCase()) : -1
  return at < 0
    ? { before: name, match: '', after: '' }
    : {
        before: name.slice(0, at),
        match: name.slice(at, at + text.length),
        after: name.slice(at + text.length),
      }
}

function onFocus() {
  open.value = true
}
</script>

<template>
  <div
    ref="root"
    class="assignee-picker"
    :class="{ 'has-chips': modelValue.length, typing: query }"
    @click="input?.focus()"
  >
    <span v-for="person in chosen" :key="person.id" class="assignee-chip">
      <span class="avatar">{{ initials(person.displayName) }}</span>
      <span class="chip-name">{{ person.displayName }}</span>
      <button
        type="button"
        class="chip-remove"
        :aria-label="`Remove ${person.displayName}`"
        @mousedown.prevent
        @click.stop="remove(person.id)"
      >
        ×
      </button>
    </span>
    <input
      ref="input"
      v-model="query"
      class="assignee-search"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      :aria-label="`Add to ${label.toLowerCase()}`"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="open && matches.length ? `${listId}-${active}` : undefined"
      :placeholder="modelValue.length ? '' : placeholder"
      :style="modelValue.length && query ? { width: `${query.length + 1}ch` } : undefined"
      @focus="onFocus"
      @blur="open = false"
      @input="((active = 0), (open = true))"
      @keydown="onKeydown"
    />
    <FloatingPanel
      v-if="open"
      :id="listId"
      tag="ul"
      class="assignee-menu"
      role="listbox"
      :anchor="root"
      :match-width="240"
    >
      <li
        v-for="(person, index) in matches"
        :id="`${listId}-${index}`"
        :key="person.id"
        class="assignee-option"
        role="option"
        :aria-selected="index === active"
        @mousedown.prevent
        @click="add(person)"
        @mousemove="active = index"
      >
        <span class="avatar">{{ initials(person.displayName) }}</span>
        <span
          >{{ parts(person.displayName).before
          }}<strong>{{ parts(person.displayName).match }}</strong
          >{{ parts(person.displayName).after }}</span
        >
      </li>
      <li v-if="!matches.length" class="assignee-empty">
        {{
          query.trim()
            ? `No team member matches “${query.trim()}”. Coaches add people in Settings.`
            : 'Everyone on the team is assigned.'
        }}
      </li>
    </FloatingPanel>
  </div>
</template>

<style scoped>
.assignee-picker {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding: 3px 6px;
  border: 1px solid #d5dce5;
  border-radius: 6px;
  background: #fff;
  cursor: text;
}
.assignee-picker:focus-within {
  border-color: var(--team-line);
  box-shadow: 0 0 0 2px var(--team-soft);
}
.assignee-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  min-width: 0;
  height: 26px;
  padding: 0 4px 0 3px;
  border-radius: 13px;
  background: #f1f4f8;
  color: #2c343b;
  font-size: 12px;
  white-space: nowrap;
}
.chip-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.avatar {
  display: inline-grid;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 50%;
  background: #e2ece6;
  color: #27654f;
  font-size: 8px;
  font-weight: 800;
}
.chip-remove {
  display: grid;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #737d86;
  font-size: 13px;
  line-height: 1;
  opacity: 0;
}
.assignee-chip:hover .chip-remove,
.chip-remove:focus-visible {
  opacity: 1;
}
.chip-remove:hover {
  background: #dfe4ea;
  color: #a43d34;
}
@media (hover: none) {
  .chip-remove {
    opacity: 1;
  }
}
.assignee-search {
  flex: 1 1 24px;
  min-width: 24px;
  height: 26px;
  padding: 0 4px;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 13px;
}
/* With people picked, the search box takes no room until something is typed, so it never adds an empty line. */
.has-chips .assignee-search {
  flex: 0 0 auto;
  min-width: 0;
  padding: 0;
}
.has-chips:not(.typing) .assignee-search {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
}
</style>

<style>
/* The list is teleported to <body> (FloatingPanel), so these styles aren't scoped. */
.assignee-menu {
  z-index: 45;
  display: grid;
  max-height: 260px;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  box-shadow: var(--shadow);
}
.assignee-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px 7px 10px;
  border-left: 3px solid transparent;
  font-size: 14px;
  cursor: pointer;
}
.assignee-option[aria-selected='true'] {
  border-left-color: #356fd1;
  background: #f1f4f8;
}
.assignee-option .avatar {
  display: inline-grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  background: #e2ece6;
  color: #27654f;
  font-size: 9px;
  font-weight: 800;
}
.assignee-option strong {
  font-weight: 750;
}
.assignee-empty {
  padding: 8px 12px;
  color: #737d86;
  font-size: 13px;
}
</style>
