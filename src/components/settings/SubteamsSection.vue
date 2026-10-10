<script setup lang="ts">
// The team's subteams: recolor (click the colored tag), edit the name and description, add, and delete with
// reassignment (its tasks move to another subteam or none). Mentors and coaches edit (team settings are adults').
// Tasks, objectives, and members store subteam ids, so renaming needs no clean-up.
import { computed, ref } from 'vue'
import { writes } from '@/data'
import { slugify } from '@/model/slug'
import { SUBTEAM_COLORS, type Subteam, type SubteamColor } from '@/model/types'
import type { TeamData } from '@/composables/useTeamData'
import { useToast } from '@/stores/toast'
import { plural } from '@/ui/format'
import ChoiceMenu from '@/components/ui/ChoiceMenu.vue'
import SelectButton from '@/components/ui/SelectButton.vue'
import SubteamTags from '@/components/ui/SubteamTags.vue'

const props = defineProps<{ team: TeamData }>()
const toast = useToast()
const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)
const teamId = computed(() => props.team.teamId.value!)
const editable = computed(() => props.team.can.value.manage)
const subteams = computed(() => props.team.subteams.value)

function usage(id: string) {
  const members = props.team.members.value.filter((m) =>
    (m.subteams[teamId.value] ?? []).includes(id),
  ).length
  const tasks = props.team.tasks.value.filter((t) => t.subteamIds.includes(id)).length
  return `${plural(members, 'member')} · ${plural(tasks, 'task')}`
}
function save(next: Subteam[]) {
  return writes.updateTeam(teamId.value, { subteams: next }).catch(fail)
}

// ---------- recolor ----------
const colorFor = ref<{ id: string; anchor: HTMLElement } | null>(null)
function recolor(color: SubteamColor) {
  const id = colorFor.value?.id
  void save(subteams.value.map((s) => (s.id === id ? { ...s, color } : s)))
}

// ---------- edit / add ----------
const editing = ref<string | 'new' | null>(null)
const draft = ref({ name: '', description: '', color: 'gray' as SubteamColor })
function startEdit(subteam: Subteam | null) {
  editing.value = subteam?.id ?? 'new'
  draft.value = subteam
    ? { name: subteam.name, description: subteam.description, color: subteam.color }
    : {
        name: '',
        description: '',
        color: SUBTEAM_COLORS.find((c) => !subteams.value.some((s) => s.color === c)) ?? 'gray',
      }
}
function commit() {
  const name = draft.value.name.replace(/\s+/g, ' ').trim()
  if (!name) return toast.show('The subteam needs a name.')
  const description = draft.value.description.replace(/\s+/g, ' ').trim()
  if (editing.value === 'new') {
    let id = slugify(name) || 'subteam'
    while (subteams.value.some((s) => s.id === id)) id = `${id}-2`
    void save([...subteams.value, { id, name, description, color: draft.value.color }])
    toast.show(`Added ${name}`)
  } else {
    void save(subteams.value.map((s) => (s.id === editing.value ? { ...s, name, description } : s)))
  }
  editing.value = null
}

// ---------- delete ----------
const deleting = ref<string | null>(null)
const moveTo = ref<string>('')
function startDelete(id: string) {
  deleting.value = id
  moveTo.value = ''
}
async function remove(id: string) {
  const target = moveTo.value || null
  const swap = (ids: readonly string[]) => [
    ...new Set(ids.map((x) => (x === id ? target : x)).filter((x): x is string => !!x)),
  ]
  const name = subteams.value.find((s) => s.id === id)?.name ?? 'Subteam'
  await save(subteams.value.filter((s) => s.id !== id))
  props.team.tasks.value
    .filter(
      (task) =>
        task.subteamIds.includes(id) || task.subtasks.some((s) => s.subteamIds.includes(id)),
    )
    .forEach((task) =>
      writes
        .updateTask(teamId.value, task.id, {
          subteamIds: swap(task.subteamIds),
          subtasks: task.subtasks.map((s) => ({ ...s, subteamIds: swap(s.subteamIds) })),
        })
        .catch(fail),
    )
  props.team.sprints.value
    .filter((sprint) => sprint.objectives.some((o) => o.subteamIds.includes(id)))
    .forEach((sprint) =>
      writes
        .updateSprint(teamId.value, sprint.id, {
          objectives: sprint.objectives.map((o) => ({ ...o, subteamIds: swap(o.subteamIds) })),
        })
        .catch(fail),
    )
  props.team.members.value
    .filter((m) => (m.subteams[teamId.value] ?? []).includes(id))
    .forEach((m) =>
      writes
        .updateMember(m.id, {
          subteams: { ...m.subteams, [teamId.value]: swap(m.subteams[teamId.value] ?? []) },
        })
        .catch(fail),
    )
  deleting.value = null
  toast.show(`${name} deleted`)
}
const moveOptions = computed(() => [
  { value: '', label: 'No subteam' },
  ...subteams.value
    .filter((s) => s.id !== deleting.value)
    .map((s) => ({ value: s.id, label: s.name })),
])
</script>

<template>
  <section class="settings-section">
    <header>
      <div>
        <h3>Subteams</h3>
        <p>Rename, recolor, or add subteams. Changes apply to every task and objective.</p>
      </div>
      <button
        v-if="editable && editing !== 'new'"
        type="button"
        class="small-button"
        @click="startEdit(null)"
      >
        ＋ Add subteam
      </button>
    </header>

    <form v-if="editing === 'new'" class="inline-form" @submit.prevent="commit">
      <div class="form-row">
        <label class="settings-field">Name <input v-model="draft.name" maxlength="24" /></label>
        <label class="settings-field"
          >Description
          <input v-model="draft.description" maxlength="80" placeholder="What this subteam does"
        /></label>
      </div>
      <div class="form-actions">
        <button type="button" class="small-button" @click="editing = null">Cancel</button>
        <button type="submit" class="small-button primary">Add subteam</button>
      </div>
    </form>

    <template v-for="subteam in subteams" :key="subteam.id">
      <div v-if="deleting === subteam.id" class="confirm-row">
        <span>Delete {{ subteam.name }}? Move its tasks to</span>
        <SelectButton v-model="moveTo" label="Move its tasks to" :options="moveOptions" />
        <span class="actions">
          <button type="button" class="small-button" @click="deleting = null">Cancel</button>
          <button type="button" class="small-button danger" @click="remove(subteam.id)">
            Delete
          </button>
        </span>
      </div>
      <form v-else-if="editing === subteam.id" class="inline-form" @submit.prevent="commit">
        <div class="form-row">
          <label class="settings-field">Name <input v-model="draft.name" maxlength="24" /></label>
          <label class="settings-field"
            >Description <input v-model="draft.description" maxlength="80"
          /></label>
        </div>
        <div class="form-actions">
          <button type="button" class="small-button" @click="editing = null">Cancel</button>
          <button type="submit" class="small-button primary">Save</button>
        </div>
      </form>
      <div v-else class="settings-row">
        <button
          v-if="editable"
          type="button"
          class="tag-button"
          :aria-label="`Change ${subteam.name}'s color`"
          @click="colorFor = { id: subteam.id, anchor: $event.currentTarget as HTMLElement }"
        >
          <SubteamTags :subteams="subteams" :ids="[subteam.id]" />
        </button>
        <SubteamTags v-else :subteams="subteams" :ids="[subteam.id]" />
        <span class="description">{{ subteam.description }}</span>
        <span class="muted">{{ usage(subteam.id) }}</span>
        <template v-if="editable">
          <button type="button" class="link-button" @click="startEdit(subteam)">Edit</button>
          <button type="button" class="link-button danger" @click="startDelete(subteam.id)">
            Delete
          </button>
        </template>
      </div>
    </template>
    <ChoiceMenu
      v-if="colorFor"
      :anchor="colorFor.anchor"
      :options="SUBTEAM_COLORS.map((color) => ({ value: color, label: color }))"
      :selected="subteams.find((s) => s.id === colorFor?.id)?.color"
      @pick="recolor($event as SubteamColor)"
      @close="colorFor = null"
    >
      <template #option="{ option }">
        <SubteamTags
          :subteams="[
            {
              id: 'x',
              name: subteams.find((s) => s.id === colorFor?.id)?.name ?? '',
              color: option.value as SubteamColor,
              description: '',
            },
          ]"
          :ids="['x']"
        />
      </template>
    </ChoiceMenu>
  </section>
</template>

<style scoped>
.tag-button {
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
}
.tag-button:hover :deep(.tag),
.tag-button:focus-visible :deep(.tag) {
  box-shadow: 0 0 0 2px var(--team-line);
}
.description {
  flex: 1;
  min-width: 0;
  color: #59636d;
  font-size: 13px;
}
</style>
