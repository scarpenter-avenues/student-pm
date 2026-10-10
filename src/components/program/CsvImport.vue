<script setup lang="ts">
// Import people from a CSV: Name · Email · Role · Subteams · Team (Team last and optional: a name or FTC number;
// rows without one go to the team picked here). A preview marks each row ready or skipped before anything is added.
import { computed, ref } from 'vue'
import { writes } from '@/data'
import { CSV_TEMPLATE, checkRows, parseCsv, type ImportTeam } from '@/model/csv'
import { ROLE_LABELS, type ProgramAuth } from '@/model/types'
import { useToast } from '@/stores/toast'
import { plural } from '@/ui/format'
import SubteamTags from '@/components/ui/SubteamTags.vue'
import TeamPicker from '@/components/ui/TeamPicker.vue'

const props = defineProps<{
  teams: readonly (ImportTeam & { color: string })[]
  defaultTeamId: string | null
  existingNames: readonly string[]
  existingEmails: readonly string[]
  auth: ProgramAuth | null
}>()
const emit = defineEmits<{ close: [] }>()
const toast = useToast()

const fallback = ref<string[]>(props.defaultTeamId ? [props.defaultTeamId] : [])
const rows = ref<string[][] | null>(null)
const fileName = ref('')
const candidates = computed(() =>
  rows.value
    ? checkRows(rows.value, {
        teams: props.teams,
        defaultTeamId: fallback.value[0] ?? null,
        existingNames: props.existingNames,
        existingEmails: props.existingEmails,
        auth: props.auth,
      })
    : [],
)
const ready = computed(() => candidates.value.filter((c) => !c.error))
const templateHref = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }))

async function choose(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 200 * 1024) return toast.show('That file is too big for a roster.')
  fileName.value = file.name
  rows.value = parseCsv(await file.text())
}
function add() {
  ready.value.forEach((c) =>
    writes
      .saveInvite({
        email: c.email,
        displayName: c.name,
        role: c.role!,
        teamIds: c.teamId ? [c.teamId] : [],
        subteams: c.teamId && c.subteamIds.length ? { [c.teamId]: c.subteamIds } : {},
      })
      .catch((e: Error) => toast.show(`Couldn't add ${c.name}: ${e.message}`)),
  )
  toast.show(
    `Added ${plural(ready.value.length, 'person', 'people')} to the program. They join when they first sign in.`,
  )
  emit('close')
}
const teamName = (id: string | null) =>
  id ? (props.teams.find((t) => t.id === id)?.name ?? '') : 'No team'
</script>

<template>
  <div class="goal-modal-overlay" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div
      class="goal-modal import-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Import people from a CSV"
    >
      <p class="goal-kicker">People</p>
      <h2>Import people from a CSV</h2>
      <p class="goal-lead">
        One person per row, with these columns in this order. A header row is optional.
      </p>
      <table class="columns">
        <tbody>
          <tr>
            <th>A · Name</th>
            <td>First name and last initial (full last names are shortened).</td>
          </tr>
          <tr>
            <th>B · Email</th>
            <td>Their sign-in email. Never shown in member lists.</td>
          </tr>
          <tr>
            <th>C · Role</th>
            <td>Student, Team lead, Team mentor, or Program coach (blank = Student).</td>
          </tr>
          <tr>
            <th>D · Subteams</th>
            <td>Optional, separated by ; (e.g. Mechanical;Software).</td>
          </tr>
          <tr>
            <th>E · Team</th>
            <td>Optional: a team name or FTC number.</td>
          </tr>
        </tbody>
      </table>
      <pre class="example">{{ CSV_TEMPLATE.trim() }}</pre>
      <a class="template" :href="templateHref" download="people-template.csv">Download template</a>
      <p class="muted">
        Only these five columns are read. Extra columns are ignored and never saved. Don't include
        personal emails, phone numbers, or birthdays.
      </p>
      <label class="fallback">
        Team for rows without one
        <TeamPicker v-model="fallback" label="Team for rows without one" single :teams="teams" />
      </label>
      <label class="pick">
        <input type="file" accept=".csv,text/csv" @change="choose" />
        <span>{{ fileName || 'Choose a CSV file…' }}</span>
      </label>
      <template v-if="rows">
        <p class="summary">
          {{
            candidates.length
              ? `${ready.length} ready to add${candidates.length - ready.length ? ` · ${candidates.length - ready.length} will be skipped` : ''}`
              : 'No rows found in that file.'
          }}
        </p>
        <table v-if="candidates.length" class="preview">
          <thead>
            <tr>
              <th />
              <th>Name</th>
              <th>Role</th>
              <th>Team</th>
              <th>Subteams</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(c, i) in candidates" :key="i" :class="{ skipped: c.error }">
              <td>{{ c.error ? '✕' : '✓' }}</td>
              <td>{{ c.name || '—' }}</td>
              <td>{{ c.role ? ROLE_LABELS[c.role] : '—' }}</td>
              <td>{{ c.role === 'coach' ? 'All teams' : teamName(c.teamId) }}</td>
              <td>
                <SubteamTags
                  v-if="c.teamId"
                  :subteams="teams.find((t) => t.id === c.teamId)?.subteams ?? []"
                  :ids="c.subteamIds"
                />
              </td>
              <td class="notes">{{ [c.error, ...c.notes].filter(Boolean).join(' · ') }}</td>
            </tr>
          </tbody>
        </table>
      </template>
      <div class="goal-modal-actions">
        <button type="button" class="goal-button" @click="emit('close')">Cancel</button>
        <button type="button" class="goal-button primary" :disabled="!ready.length" @click="add">
          {{ ready.length ? `Add ${plural(ready.length, 'person', 'people')}` : 'Add people' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.import-modal {
  width: min(680px, 100%);
}
.columns {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.columns th {
  width: 120px;
  padding: 3px 0;
  color: #2c343b;
  text-align: left;
}
.columns td {
  color: #59636d;
}
.example {
  overflow-x: auto;
  margin: 10px 0 4px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #f6f8fa;
  font-size: 12px;
}
.template {
  font-size: 13px;
}
.fallback {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0;
  color: #4b5560;
  font-size: 13px;
}
.pick {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px dashed var(--team-line);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}
.pick input {
  width: 1px;
  height: 1px;
  opacity: 0;
}
.summary {
  margin: 12px 0 6px;
  font-size: 13px;
  font-weight: 650;
}
.preview {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.preview th,
.preview td {
  padding: 4px 6px;
  border-bottom: 1px solid #edf0f2;
  text-align: left;
}
.skipped {
  color: #a43d34;
}
.notes {
  color: #737d86;
  font-size: 12px;
}
</style>
