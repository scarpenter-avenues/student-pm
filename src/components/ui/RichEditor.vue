<script setup lang="ts">
// Rich text (Team Home, announcements, task descriptions, huddles), ported from the mock-up's createRichEditor.
// Tiptap is bundled from npm: no third-party requests. Select text for the formatting bubble; ⌘/Ctrl+K adds a link.
// Links must be http(s) and open in a new tab without passing on who sent the visitor. Editors given `mentions` (a
// search) offer @ mentions; every editor shows saved ones (see src/ui/mentions.ts).
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import { useToast } from '@/stores/toast'
import { teamAccent, teamColorOf } from '@/ui/teamColor'
import { MentionNode, type MentionItem, type MentionSearch } from '@/ui/mentions'

const props = withDefaults(
  defineProps<{
    modelValue: string
    editable?: boolean
    placeholder?: string
    label?: string
    /** Turns on @ mentions: what to offer for a query. */
    mentions?: MentionSearch | null
  }>(),
  { editable: true, placeholder: 'Write something…', label: 'Text', mentions: null },
)
const emit = defineEmits<{
  'update:modelValue': [html: string]
  /** Every edit, with the plain text too (stored alongside the HTML for search and email). */
  change: [value: { html: string; text: string }]
}>()

/** "example.com" → "https://example.com/"; anything but http(s) → null. */
function normalizeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

// ---------- @ mentions ----------
const mention = reactive({
  open: false,
  items: [] as MentionItem[],
  index: 0,
  left: 0,
  top: 0,
  command: null as ((item: MentionItem) => void) | null,
})
function showMentions(props: {
  items: MentionItem[]
  command: (item: MentionItem) => void
  clientRect?: (() => DOMRect | null) | null
}) {
  const rect = props.clientRect?.()
  Object.assign(mention, {
    open: true,
    items: props.items,
    index: Math.min(mention.index, Math.max(0, props.items.length - 1)),
    command: props.command,
    ...(rect ? { left: rect.left, top: rect.bottom + 4 } : {}),
  })
}
function pickMention(item: MentionItem | undefined) {
  if (!item || !mention.command) return
  const { id, label, kind, teamId, color } = item
  mention.command({ id, label, kind, teamId, color } as MentionItem)
  mention.open = false
}
function onMentionKey(event: KeyboardEvent): boolean {
  if (!mention.open || !mention.items.length) return false
  const count = mention.items.length
  if (event.key === 'ArrowDown') mention.index = (mention.index + 1) % count
  else if (event.key === 'ArrowUp') mention.index = (mention.index - 1 + count) % count
  else if (event.key === 'Enter' || event.key === 'Tab') pickMention(mention.items[mention.index])
  else if (event.key === 'Escape') mention.open = false
  else return false
  // Esc and Enter stay with the menu (not the form around the editor).
  event.stopPropagation()
  return true
}

const editor = useEditor({
  content: props.modelValue,
  editable: props.editable,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => normalizeUrl(url) !== null,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
      },
    }),
    Placeholder.configure({ placeholder: () => props.placeholder }),
    MentionNode.configure({
      suggestion: {
        char: '@',
        allow: () => !!props.mentions,
        items: ({ query }) => props.mentions?.(query) ?? [],
        render: () => ({
          onStart: (state) => {
            mention.index = 0
            showMentions(state as never)
          },
          onUpdate: (state) => showMentions(state as never),
          onKeyDown: ({ event }) => onMentionKey(event),
          onExit: () => {
            mention.open = false
          },
        }),
      },
    }),
  ],
  editorProps: { attributes: { 'aria-label': props.label, class: 'rich-content' } },
  onUpdate: ({ editor: current }) => {
    const html = current.isEmpty ? '' : current.getHTML()
    emit('update:modelValue', html)
    emit('change', { html, text: current.getText().trim() })
  },
})

// Someone else's save arrives while this editor isn't being used: show it.
watch(
  () => props.modelValue,
  (html) => {
    const current = editor.value
    if (!current || current.isFocused) return
    if ((current.isEmpty ? '' : current.getHTML()) !== html)
      current.commands.setContent(html, { emitUpdate: false })
  },
)
watch(
  () => props.editable,
  (editable) => editor.value?.setEditable(editable),
)

// ---------- formatting bubble ----------
const linkMode = ref(false)
const linkText = ref('')
const linkInput = ref<HTMLInputElement | null>(null)
const toast = useToast()

type Format = 'bold' | 'italic' | 'strike' | 'code' | 'heading' | 'bulletList'
const FORMATS: { format: Format; label: string; title: string; text: string }[] = [
  { format: 'bold', label: 'Bold', title: 'Bold (⌘B)', text: 'B' },
  { format: 'italic', label: 'Italic', title: 'Italic (⌘I)', text: 'I' },
  { format: 'strike', label: 'Strikethrough', title: 'Strikethrough', text: 'S' },
  { format: 'code', label: 'Inline code', title: 'Inline code', text: '</>' },
  { format: 'heading', label: 'Heading', title: 'Heading', text: 'H' },
  { format: 'bulletList', label: 'Bulleted list', title: 'Bulleted list', text: '•≡' },
]

function apply(format: Format) {
  const chain = editor.value?.chain().focus()
  if (!chain) return
  const commands = {
    bold: () => chain.toggleBold(),
    italic: () => chain.toggleItalic(),
    strike: () => chain.toggleStrike(),
    code: () => chain.toggleCode(),
    heading: () => chain.toggleHeading({ level: 2 }),
    bulletList: () => chain.toggleBulletList(),
  }
  commands[format]().run()
}
const isActive = (format: Format) => !!editor.value?.isActive(format)

async function showLink(show: boolean) {
  linkMode.value = show
  if (!show) return
  linkText.value = (editor.value?.getAttributes('link').href as string | undefined) ?? ''
  await nextTick()
  linkInput.value?.focus()
  linkInput.value?.select()
}
function saveLink() {
  const current = editor.value
  if (!current) return
  if (!linkText.value.trim()) return removeLink()
  const href = normalizeUrl(linkText.value)
  if (!href) {
    toast.show('Links need to start with http:// or https://')
    linkInput.value?.focus()
    return
  }
  current.chain().focus().extendMarkRange('link').setLink({ href }).run()
  linkMode.value = false
}
function removeLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  linkMode.value = false
}
function onLinkKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    linkMode.value = false
    editor.value?.commands.focus()
  }
}
function onKeydown(event: KeyboardEvent) {
  const current = editor.value
  if (
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === 'k' &&
    current?.isEditable &&
    !current.state.selection.empty
  ) {
    event.preventDefault()
    void showLink(true)
  }
}

function chipStyle(item: MentionItem) {
  if (item.kind === 'team') {
    const { bg, fg } = teamColorOf(item.color ?? undefined)
    return { background: bg, color: fg }
  }
  if (item.kind === 'student') {
    const accent = teamAccent(item.color ?? undefined)
    return { background: accent['--team-soft'], color: accent['--team-ink'] }
  }
  return {}
}

defineExpose({ focus: () => editor.value?.commands.focus('end'), editor })
onBeforeUnmount(() => editor.value?.destroy())
</script>

<template>
  <div class="rich-editor" :class="{ readonly: !editable }" @keydown="onKeydown">
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :should-show="({ editor: current, from, to }) => current.isEditable && from !== to"
      :options="{ placement: 'top', offset: 8 }"
      class="format-bubble"
      role="toolbar"
      aria-label="Text formatting"
      @mousedown="($event.target as HTMLElement).closest('input') || $event.preventDefault()"
    >
      <div v-if="!linkMode" class="bubble-format">
        <template v-for="(item, index) in FORMATS" :key="item.format">
          <span v-if="index === 4" class="bubble-divider" aria-hidden="true" />
          <button
            type="button"
            :class="{ 'is-active': isActive(item.format), [item.format]: true }"
            :aria-label="item.label"
            :aria-pressed="isActive(item.format)"
            :title="item.title"
            @click="apply(item.format)"
          >
            {{ item.text }}
          </button>
        </template>
        <span class="bubble-divider" aria-hidden="true" />
        <button type="button" aria-label="Link" title="Link (⌘K)" @click="showLink(true)">
          ↗ Link
        </button>
      </div>
      <form v-else class="bubble-link-form" @submit.prevent="saveLink">
        <input
          ref="linkInput"
          v-model="linkText"
          type="text"
          inputmode="url"
          placeholder="Paste a link…"
          aria-label="Link URL"
          @keydown="onLinkKeydown"
        />
        <button type="submit" class="apply">Apply</button>
        <button type="button" aria-label="Remove link" title="Remove link" @click="removeLink">
          ✕
        </button>
      </form>
    </BubbleMenu>
    <EditorContent :editor="editor" />
    <Teleport to="body">
      <ul
        v-if="mention.open && mention.items.length"
        class="mention-menu"
        role="listbox"
        aria-label="Mention someone"
        :style="{ left: `${mention.left}px`, top: `${mention.top}px` }"
      >
        <li
          v-for="(item, i) in mention.items"
          :key="item.id"
          role="option"
          :aria-selected="i === mention.index"
          @mousedown.prevent="pickMention(item)"
          @mouseenter="mention.index = i"
        >
          <span class="mention" :class="`mention-${item.kind}`" :style="chipStyle(item)">{{
            item.label
          }}</span>
          <small>{{ item.detail }}</small>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style>
/* Tiptap renders the content and the bubble outside this component's template, so these aren't scoped. */
.rich-content {
  min-height: 60px;
  outline: none;
  color: #36404a;
  font-size: 15px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.rich-content > :first-child {
  margin-top: 0;
}
.rich-content h1,
.rich-content h2,
.rich-content h3 {
  margin: 1.1em 0 0.35em;
  color: #202124;
  line-height: 1.3;
}
.rich-content h1 {
  font-size: 24px;
}
.rich-content h2 {
  font-size: 19px;
}
.rich-content h3 {
  font-size: 16px;
}
.rich-content p {
  margin: 0.45em 0;
}
.rich-content ul,
.rich-content ol {
  margin: 0.4em 0;
  padding-left: 24px;
}
.rich-content li p {
  margin: 0.15em 0;
}
.rich-content blockquote {
  margin: 0.7em 0;
  padding: 2px 0 2px 14px;
  border-left: 3px solid #d5dce5;
  color: #59636d;
}
.rich-content code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f1f3f6;
  color: #b0413e;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.88em;
}
.rich-content pre {
  margin: 0.7em 0;
  padding: 12px 14px;
  overflow-x: auto;
  border-radius: 6px;
  background: #f6f8fa;
}
.rich-content pre code {
  padding: 0;
  background: none;
  color: #303941;
}
.rich-content hr {
  margin: 1.2em 0;
  border: 0;
  border-top: 1px solid var(--line);
}
.rich-content a {
  color: #2864c7;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
.rich-content p.is-editor-empty:first-child::before {
  float: left;
  height: 0;
  color: #a3abb2;
  content: attr(data-placeholder);
  pointer-events: none;
}
/* Mentions: a chip without the "@" (colors come from the node; coaches and mentors are gray). Inline-block keeps a
   name on one line (ProseMirror resets white-space on non-editable nodes). */
.rich-content .mention,
.mention-menu .mention {
  display: inline-block;
  line-height: 1.35;
  padding: 1px 6px;
  border-radius: 10px;
  background: #eceff2;
  color: #3f474e;
  font-size: 0.92em;
  font-weight: 650;
  white-space: nowrap;
}
.mention-menu {
  position: fixed;
  z-index: 55;
  display: grid;
  min-width: 220px;
  max-width: 320px;
  margin: 0;
  padding: 4px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(32, 45, 61, 0.16);
  list-style: none;
}
.mention-menu li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 13px;
  cursor: pointer;
}
.mention-menu li[aria-selected='true'] {
  background: #f1f4f8;
}
.mention-menu small {
  color: #8a949c;
  font-size: 12px;
  white-space: nowrap;
}
.format-bubble {
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(32, 45, 61, 0.16);
}
.format-bubble button {
  min-width: 30px;
  height: 30px;
  padding: 0 7px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #3f474e;
  font-size: 14px;
}
.format-bubble button:hover {
  background: #f1f4f8;
}
.format-bubble button.is-active {
  background: var(--team-soft);
  color: var(--team-ink);
}
.format-bubble .bold {
  font-weight: 800;
}
.format-bubble .italic {
  font-style: italic;
}
.format-bubble .strike {
  text-decoration: line-through;
}
.bubble-format,
.bubble-link-form {
  display: flex;
  align-items: center;
  gap: 2px;
}
.bubble-divider {
  width: 1px;
  height: 18px;
  margin: 0 3px;
  background: var(--line);
}
.bubble-link-form {
  gap: 4px;
}
.bubble-link-form input {
  width: 220px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid #d5dce5;
  border-radius: 5px;
  font-size: 13px;
}
.bubble-link-form input:focus {
  border-color: var(--team-line);
  outline: 2px solid var(--team-soft);
}
.format-bubble .apply {
  background: #356fd1;
  color: #fff;
}
.format-bubble .apply:hover {
  background: #2b5db3;
}
@media (max-width: 680px) {
  .bubble-link-form input {
    width: 160px;
  }
}
</style>
