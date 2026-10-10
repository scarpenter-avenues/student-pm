<script setup lang="ts">
// Stored rich text, shown read-only. Never v-html: the HTML is parsed through the editor's schema, which drops
// scripts, event handlers, and non-http(s) links, whoever wrote it.
import RichEditor from './RichEditor.vue'

defineProps<{ html: string; label?: string }>()
</script>

<template>
  <RichEditor
    :key="html"
    class="rich-text"
    :model-value="html"
    :editable="false"
    :label="label ?? 'Text'"
  />
</template>
