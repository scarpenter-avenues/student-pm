<script setup lang="ts">
// Subteam defaults: copied into new teams only (each team changes its own afterward). Add, edit, recolor (click the
// colored tag), delete.
import { ref } from 'vue'
import { updateDoc } from 'firebase/firestore'
import { refs } from '@/data'
import { slugify } from '@/model/slug'
import { SUBTEAM_COLORS, type Subteam, type SubteamColor } from '@/model/types'
import { useToast } from '@/stores/toast'
import ChoiceMenu from '@/components/ui/ChoiceMenu.vue'
import SubteamTags from '@/components/ui/SubteamTags.vue'

const props = defineProps<{ defaults: readonly Subteam[] }>()
const toast = useToast()
function save(next: Subteam[]) {
  updateDoc(refs.program(), { subteamDefaults: next }).catch((e: Error) =>
    toast.show(`Couldn't save: ${e.message}`),
  )
}
const editing = ref<string | 'new' | null>(null)
const draft = ref({ name: '', description: '' })
function start(subteam: Subteam | null) {
  editing.value = subteam?.id ?? 'new'
  draft.value = { name: subteam?.name ?? '', description: subteam?.description ?? '' }
}
function commit() {
  const name = draft.value.name.replace(/\s+/g, ' ').trim()
  if (!name) return
  const description = draft.value.description.trim()
  if (
    props.defaults.some(
      (s) => s.id !== editing.value && s.name.toLowerCase() === name.toLowerCase(),
    )
  )
    return toast.show("There's already a subteam with that name")
  if (editing.value === 'new') {
    let id = slugify(name) || 'subteam'
    while (props.defaults.some((s) => s.id === id)) id = `${id}-2`
    const color = SUBTEAM_COLORS.find((c) => !props.defaults.some((s) => s.color === c)) ?? 'gray'
    save([...props.defaults, { id, name, description, color }])
  } else save(props.defaults.map((s) => (s.id === editing.value ? { ...s, name, description } : s)))
  editing.value = null
}
const colorFor = ref<{ id: string; anchor: HTMLElement } | null>(null)
</script>

<template>
  <section class="settings-section">
    <header>
      <div>
        <h3>Subteam defaults</h3>
        <p>
          New teams start with these subteams. Each team can change its own afterward; editing this
          list doesn't change existing teams.
        </p>
      </div>
      <button v-if="editing !== 'new'" type="button" class="small-button" @click="start(null)">
        ＋ Add subteam
      </button>
    </header>
    <template
      v-for="subteam in [...defaults, ...(editing === 'new' ? [null] : [])]"
      :key="subteam?.id ?? 'new'"
    >
      <form
        v-if="editing === (subteam?.id ?? 'new')"
        class="inline-form"
        @submit.prevent="commit"
        @keydown.esc="editing = null"
      >
        <div class="form-row">
          <input
            v-model="draft.name"
            class="settings-input"
            maxlength="24"
            placeholder="Subteam name"
            aria-label="Subteam name"
          />
          <input
            v-model="draft.description"
            class="settings-input"
            maxlength="80"
            placeholder="One line: what does this subteam own?"
            aria-label="Description"
          />
        </div>
        <div class="form-actions">
          <button type="button" class="small-button" @click="editing = null">Cancel</button>
          <button type="submit" class="small-button primary">
            {{ subteam ? 'Save' : 'Add subteam' }}
          </button>
        </div>
      </form>
      <div v-else-if="subteam" class="settings-row">
        <span class="copy">
          <button
            type="button"
            class="tag-button"
            :aria-label="`Change ${subteam.name} color`"
            @click="colorFor = { id: subteam.id, anchor: $event.currentTarget as HTMLElement }"
          >
            <SubteamTags :subteams="defaults" :ids="[subteam.id]" />
          </button>
          <small>{{ subteam.description || 'No description' }}</small>
        </span>
        <button type="button" class="link-button" @click="start(subteam)">Edit</button>
        <button
          type="button"
          class="link-button danger"
          :disabled="defaults.length === 1"
          @click="save(defaults.filter((s) => s.id !== subteam.id))"
        >
          Delete
        </button>
      </div>
    </template>
    <ChoiceMenu
      v-if="colorFor"
      :anchor="colorFor.anchor"
      :options="SUBTEAM_COLORS.map((color) => ({ value: color, label: color }))"
      :selected="defaults.find((s) => s.id === colorFor?.id)?.color"
      @pick="
        save(
          defaults.map((s) =>
            s.id === colorFor?.id ? { ...s, color: $event as SubteamColor } : s,
          ),
        )
      "
      @close="colorFor = null"
    >
      <template #option="{ option }">
        <SubteamTags
          :subteams="[
            { id: 'x', name: option.label, color: option.value as SubteamColor, description: '' },
          ]"
          :ids="['x']"
        />
      </template>
    </ChoiceMenu>
  </section>
</template>

<style scoped>
.copy {
  display: grid;
  flex: 1;
  gap: 2px;
}
.copy small {
  color: #737d86;
  font-size: 12px;
}
.tag-button {
  justify-self: start;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
}
.tag-button:hover :deep(.tag) {
  box-shadow: 0 0 0 2px var(--team-line);
}
</style>
