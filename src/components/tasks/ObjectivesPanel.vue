<script setup lang="ts">
// A sprint's objectives: one line each (80 characters max), subteam tags, and a met mark. Read-only and dense on the
// task tabs, where leads, mentors, and coaches can still mark them met. Planning passes `editable` to add, edit, and
// remove them. With several sprints ("All sprints"), objectives are grouped by sprint.
import { computed, nextTick, reactive, ref } from 'vue'
import { writes } from '@/data'
import type { Objective, Sprint, Subteam, WithId } from '@/model/types'
import { useToast } from '@/stores/toast'
import SubteamTags from '@/components/ui/SubteamTags.vue'

const MAX = 80

const props = withDefaults(
  defineProps<{
    teamId: string
    sprints: readonly WithId<Sprint>[]
    subteams: readonly Subteam[]
    canMark: boolean
    editable?: boolean
    /** Start collapsed (Planning). */
    collapsed?: boolean
  }>(),
  { editable: false, collapsed: false },
)

const toast = useToast()
const open = ref(!props.collapsed)
const grouped = computed(() => props.sprints.length > 1)
const all = computed(() => props.sprints.flatMap((sprint) => sprint.objectives))
const metCount = computed(() => all.value.filter((objective) => objective.met).length)

function save(sprint: WithId<Sprint>, objectives: Objective[]) {
  writes
    .updateSprint(props.teamId, sprint.id, { objectives })
    .catch((error: Error) => toast.show(`Couldn't save: ${error.message}`))
}
function toggleMet(sprint: WithId<Sprint>, objective: Objective) {
  save(
    sprint,
    sprint.objectives.map((item) =>
      item.id === objective.id ? { ...item, met: !item.met } : item,
    ),
  )
}
function remove(sprint: WithId<Sprint>, objective: Objective) {
  save(
    sprint,
    sprint.objectives.filter((item) => item.id !== objective.id),
  )
  toast.show('Objective removed', { label: 'Undo', run: () => save(sprint, sprint.objectives) })
}

// ---------- editing (Planning) ----------
const editing = reactive<{
  sprintId: string | null
  objectiveId: string | null
  text: string
  subteamIds: string[]
}>({
  sprintId: null,
  objectiveId: null,
  text: '',
  subteamIds: [],
})
const input = ref<HTMLInputElement[] | null>(null)
async function startEdit(sprint: WithId<Sprint>, objective: Objective | null) {
  Object.assign(editing, {
    sprintId: sprint.id,
    objectiveId: objective?.id ?? null,
    text: objective?.text ?? '',
    subteamIds: [...(objective?.subteamIds ?? [])],
  })
  open.value = true
  await nextTick()
  input.value?.[0]?.focus()
}
function cancel() {
  editing.sprintId = null
}
function commit(sprint: WithId<Sprint>) {
  const text = editing.text.replace(/\s+/g, ' ').trim().slice(0, MAX)
  if (!text) return cancel()
  const subteamIds = props.subteams.map((s) => s.id).filter((id) => editing.subteamIds.includes(id))
  const objectives = editing.objectiveId
    ? sprint.objectives.map((item) =>
        item.id === editing.objectiveId ? { ...item, text, subteamIds } : item,
      )
    : [
        ...sprint.objectives,
        { id: `o_${crypto.randomUUID().slice(0, 8)}`, text, subteamIds, met: false },
      ]
  save(sprint, objectives)
  cancel()
}
function toggleSubteam(id: string) {
  editing.subteamIds = editing.subteamIds.includes(id)
    ? editing.subteamIds.filter((other) => other !== id)
    : [...editing.subteamIds, id]
}
function onKeydown(event: KeyboardEvent, sprint: WithId<Sprint>) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commit(sprint)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    cancel()
  }
}
</script>

<template>
  <section class="objectives" :class="{ editable }">
    <div class="objectives-header">
      <button type="button" class="objectives-toggle" :aria-expanded="open" @click="open = !open">
        <span class="chevron" aria-hidden="true">▼</span>
        <h3>Objectives</h3>
        <small v-if="all.length">{{ metCount }} of {{ all.length }} met</small>
      </button>
    </div>
    <div v-if="open" class="objectives-body">
      <div v-for="sprint in sprints" :key="sprint.id" class="objectives-group">
        <p v-if="grouped && (sprint.objectives.length || editable)" class="group-name">
          {{ sprint.name }}
        </p>
        <ul class="objectives-list">
          <template v-for="objective in sprint.objectives" :key="objective.id">
            <li
              v-if="editing.sprintId === sprint.id && editing.objectiveId === objective.id"
              class="objective-editor"
            >
              <div class="input-row">
                <input
                  ref="input"
                  v-model="editing.text"
                  :maxlength="MAX"
                  aria-label="Objective"
                  @keydown="onKeydown($event, sprint)"
                />
                <span class="counter" :class="{ near: editing.text.length > MAX - 10 }"
                  >{{ editing.text.length }}/{{ MAX }}</span
                >
              </div>
              <div class="editor-foot">
                <span>Subteams</span>
                <button
                  v-for="subteam in subteams"
                  :key="subteam.id"
                  type="button"
                  class="subteam-toggle"
                  :aria-pressed="editing.subteamIds.includes(subteam.id)"
                  @click="toggleSubteam(subteam.id)"
                >
                  <SubteamTags :subteams="subteams" :ids="[subteam.id]" />
                </button>
                <div class="editor-actions">
                  <button type="button" @click="cancel">Cancel</button>
                  <button type="button" class="save" @click="commit(sprint)">Save</button>
                </div>
              </div>
            </li>
            <li v-else class="objective-row" :class="{ met: objective.met }">
              <button
                v-if="canMark"
                type="button"
                class="met-mark"
                :aria-pressed="objective.met"
                :aria-label="`${objective.met ? 'Mark not met' : 'Mark met'}: ${objective.text}`"
                @click="toggleMet(sprint, objective)"
              >
                {{ objective.met ? '✓' : '' }}
              </button>
              <span
                v-else
                class="met-mark static"
                :aria-label="objective.met ? 'Met' : 'Not met yet'"
                >{{ objective.met ? '✓' : '' }}</span
              >
              <SubteamTags
                v-if="objective.subteamIds.length"
                :subteams="subteams"
                :ids="objective.subteamIds"
                class="objective-tags"
              />
              <button
                v-if="editable"
                type="button"
                class="objective-text"
                title="Click to edit"
                @click="startEdit(sprint, objective)"
              >
                {{ objective.text }}
              </button>
              <span v-else class="objective-text" :title="objective.text">{{
                objective.text
              }}</span>
              <button
                v-if="editable"
                type="button"
                class="objective-remove"
                :aria-label="`Remove ${objective.text}`"
                @click="remove(sprint, objective)"
              >
                ×
              </button>
            </li>
          </template>
          <li
            v-if="editing.sprintId === sprint.id && editing.objectiveId === null"
            class="objective-editor"
          >
            <div class="input-row">
              <input
                ref="input"
                v-model="editing.text"
                :maxlength="MAX"
                placeholder="What should be true by the end of the sprint?"
                aria-label="New objective"
                @keydown="onKeydown($event, sprint)"
              />
              <span class="counter" :class="{ near: editing.text.length > MAX - 10 }"
                >{{ editing.text.length }}/{{ MAX }}</span
              >
            </div>
            <div class="editor-foot">
              <span>Subteams</span>
              <button
                v-for="subteam in subteams"
                :key="subteam.id"
                type="button"
                class="subteam-toggle"
                :aria-pressed="editing.subteamIds.includes(subteam.id)"
                @click="toggleSubteam(subteam.id)"
              >
                <SubteamTags :subteams="subteams" :ids="[subteam.id]" />
              </button>
              <div class="editor-actions">
                <button type="button" @click="cancel">Cancel</button>
                <button type="button" class="save" @click="commit(sprint)">Add</button>
              </div>
            </div>
          </li>
        </ul>
        <button
          v-if="editable && editing.sprintId !== sprint.id"
          type="button"
          class="objectives-add"
          @click="startEdit(sprint, null)"
        >
          + Add objective
        </button>
      </div>
      <p v-if="!all.length && !editable" class="empty">No objectives for this sprint.</p>
    </div>
  </section>
</template>

<style scoped>
.objectives {
  margin-bottom: 4px;
  padding: 6px 12px 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fafbfc;
}
.objectives-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 2px 6px 2px 0;
  border: 0;
  background: transparent;
  text-align: left;
}
.objectives-toggle h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}
.objectives-toggle small {
  color: #77818a;
  font-size: 12px;
}
.chevron {
  color: #737d86;
  font-size: 10px;
  transition: transform 0.15s ease;
}
.objectives-toggle[aria-expanded='false'] .chevron {
  transform: rotate(-90deg);
}
.group-name {
  margin: 6px 0 2px;
  color: #59636d;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}
.objectives-group + .objectives-group {
  margin-top: 4px;
  padding-top: 2px;
  border-top: 1px solid var(--line);
}
.objectives-list {
  display: grid;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}
.objective-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 26px;
  padding: 0 4px;
  border-radius: 5px;
}
.editable .objective-row:hover {
  background: #f2f5f8;
}
.met-mark {
  display: grid;
  flex: 0 0 auto;
  width: 15px;
  height: 15px;
  place-items: center;
  padding: 0;
  border: 1.5px solid #b9c1c8;
  border-radius: 50%;
  background: #fff;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
}
button.met-mark:hover {
  border-color: var(--team-ink);
}
.met .met-mark {
  border-color: #35a267;
  background: #35a267;
}
.objective-tags :deep(.tag) {
  padding: 1px 5px;
  font-size: 11px;
}
.objective-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: #2c343b;
  font-size: 13px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
button.objective-text {
  cursor: text;
}
.met .objective-text {
  color: #7b858d;
  text-decoration: line-through;
}
.objective-remove {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #8a949c;
  font-size: 16px;
  opacity: 0;
}
.objective-row:hover .objective-remove,
.objective-remove:focus-visible {
  opacity: 1;
}
.objective-remove:hover {
  background: #e9edf1;
  color: #a43d34;
}
.objective-editor {
  display: grid;
  gap: 8px;
  margin: 4px 0;
  padding: 10px;
  border: 1px solid var(--team-line);
  border-radius: 7px;
  background: #fff;
}
.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.input-row input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #d5dce5;
  border-radius: 6px;
  font-size: 13px;
}
.input-row input:focus {
  border-color: var(--team-line);
  outline: 2px solid var(--team-soft);
}
.counter {
  flex: 0 0 auto;
  color: #8a949c;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.counter.near {
  color: #b75a44;
}
.editor-foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.editor-foot > span {
  margin-right: 2px;
  color: #66717a;
  font-size: 12px;
}
.subteam-toggle {
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: none;
  opacity: 0.45;
}
.subteam-toggle[aria-pressed='true'] {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--team-line);
}
.editor-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}
.editor-actions button {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: #fff;
  font-size: 12px;
}
.editor-actions .save {
  border-color: #356fd1;
  background: #356fd1;
  color: #fff;
}
.objectives-add {
  margin: 2px 0;
  padding: 3px 4px;
  border: 0;
  background: transparent;
  color: #68747e;
  font-size: 12px;
}
.objectives-add:hover {
  color: #2864c7;
}
.empty {
  margin: 4px;
  color: #77818a;
  font-size: 13px;
}
@media (max-width: 680px) {
  .objective-tags {
    display: none;
  }
}
</style>
