<script setup lang="ts">
// Teams this season: badge, FTC number, sprint length, students, mentors (or "No mentor yet"). Open, Edit, Delete
// (with a confirm row). ＋ New team: name, FTC number (unique), sprint length, color; it starts with the subteam
// defaults and Sprint 1 today. Teams from earlier seasons sit under "Not in this season (N)".
import { computed, ref } from 'vue'
import { admin, writes } from '@/data'
import { todayIso } from '@/model/dates'
import {
  ADULT_ROLES,
  type Member,
  type Season,
  type Subteam,
  type Team,
  type WithId,
} from '@/model/types'
import { useToast } from '@/stores/toast'
import { plural } from '@/ui/format'
import TeamBadge from '@/components/TeamBadge.vue'
import SelectButton from '@/components/ui/SelectButton.vue'
import TeamColorPicker from '@/components/ui/TeamColorPicker.vue'

const props = defineProps<{
  season: WithId<Season>
  allTeams: readonly WithId<Team>[]
  members: readonly WithId<Member>[]
  subteamDefaults: readonly Subteam[]
}>()
const toast = useToast()
const teams = computed(() =>
  props.allTeams
    .filter((t) => t.seasonIds.includes(props.season.id))
    .sort((a, b) => a.name.localeCompare(b.name)),
)
const inactive = computed(() =>
  props.allTeams.filter((t) => !t.seasonIds.includes(props.season.id)),
)
const showInactive = ref(false)
const studentsOf = (id: string) =>
  props.members.filter((m) => m.teamIds.includes(id) && !ADULT_ROLES.includes(m.role)).length
const mentorsOf = (id: string) =>
  props.members
    .filter((m) => m.teamIds.includes(id) && m.role === 'mentor')
    .map((m) => m.displayName)

// ---------- form ----------
const editing = ref<string | 'new' | null>(null)
const draft = ref({ name: '', number: '', sprintDays: '14', color: 'green' })
function startForm(team: WithId<Team> | null) {
  editing.value = team?.id ?? 'new'
  draft.value = team
    ? {
        name: team.name,
        number: team.number,
        sprintDays: String(team.sprintDays),
        color: team.color,
      }
    : {
        name: '',
        number: '',
        sprintDays: '14',
        color:
          [
            'green',
            'teal',
            'blue',
            'navy',
            'purple',
            'pink',
            'red',
            'orange',
            'yellow',
            'gray',
          ].find((c) => !teams.value.some((t) => t.color === c)) ?? 'green',
      }
}
const error = ref('')
async function submit() {
  const name = draft.value.name.replace(/\s+/g, ' ').trim()
  const raw = draft.value.number.trim()
  error.value = ''
  if (!name) return (error.value = 'The team needs a name.')
  if (!/^\d{1,5}$/.test(raw) || Number(raw) === 0)
    return (error.value = 'Team numbers are 1–5 digits.')
  const number = String(Number(raw))
  const others = props.allTeams.filter((t) => t.id !== editing.value)
  if (others.some((t) => t.name.toLowerCase() === name.toLowerCase()))
    return (error.value = "There's already a team with that name.")
  if (others.some((t) => t.number === number))
    return (error.value = `FTC ${number} is already in the program.`)
  const sprintDays = Number(draft.value.sprintDays)
  try {
    if (editing.value === 'new') {
      editing.value = null
      await admin.createTeam(
        { name, number, color: draft.value.color, sprintDays },
        props.season,
        [...props.subteamDefaults],
        todayIso(),
      )
      toast.show(`${name} created`)
    } else if (editing.value) {
      const id = editing.value
      editing.value = null
      await writes.updateTeam(id, { name, number, color: draft.value.color, sprintDays })
      toast.show('Team saved')
    }
  } catch (e) {
    toast.show(`Couldn't save: ${(e as Error).message}`)
  }
}

// ---------- delete ----------
const deleting = ref<string | null>(null)
const busy = ref(false)
async function remove(team: WithId<Team>) {
  busy.value = true
  try {
    await admin.deleteTeam(team.id, props.members)
    toast.show(`${team.name} deleted`)
  } catch (e) {
    toast.show(`Couldn't delete: ${(e as Error).message}`)
  } finally {
    busy.value = false
    deleting.value = null
  }
}
async function bringBack(team: WithId<Team>) {
  try {
    await admin.addTeamToSeason(team, props.season, todayIso())
    toast.show(`${team.name} added to ${props.season.name}`)
  } catch (e) {
    toast.show(`Couldn't add it: ${(e as Error).message}`)
  }
}
const SPRINT_LENGTHS = ['7', '10', '14', '21'].map((days) => ({
  value: days,
  label: `${days} days`,
}))
</script>

<template>
  <section class="settings-section">
    <header>
      <div><h3>Teams</h3></div>
      <button v-if="editing !== 'new'" type="button" class="small-button" @click="startForm(null)">
        ＋ New team
      </button>
    </header>
    <form v-if="editing === 'new'" class="inline-form" @submit.prevent="submit">
      <div class="form-row">
        <label class="settings-field"
          >Team name <input v-model="draft.name" maxlength="40" autocomplete="off"
        /></label>
        <label class="settings-field"
          >FTC team number
          <input v-model="draft.number" maxlength="5" inputmode="numeric" autocomplete="off"
        /></label>
      </div>
      <span class="settings-field"
        >Sprint length
        <SelectButton v-model="draft.sprintDays" label="Sprint length" :options="SPRINT_LENGTHS"
          ><template #value="{ value }">{{ value }} days</template></SelectButton
        ></span
      >
      <TeamColorPicker v-model="draft.color" />
      <p class="muted">
        Starts with the default subteams ({{ subteamDefaults.map((s) => s.name).join(', ') }}) and
        Sprint 1 today. Add a mentor and students under People.
      </p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="small-button" @click="editing = null">Cancel</button>
        <button type="submit" class="small-button primary">Create team</button>
      </div>
    </form>
    <template v-for="team in teams" :key="team.id">
      <form v-if="editing === team.id" class="inline-form" @submit.prevent="submit">
        <div class="form-row">
          <label class="settings-field"
            >Team name <input v-model="draft.name" maxlength="40"
          /></label>
          <label class="settings-field"
            >FTC team number <input v-model="draft.number" maxlength="5" inputmode="numeric"
          /></label>
        </div>
        <span class="settings-field"
          >Sprint length
          <SelectButton v-model="draft.sprintDays" label="Sprint length" :options="SPRINT_LENGTHS"
            ><template #value="{ value }">{{ value }} days</template></SelectButton
          ></span
        >
        <TeamColorPicker v-model="draft.color" />
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="form-actions">
          <button type="button" class="small-button" @click="editing = null">Cancel</button>
          <button type="submit" class="small-button primary">Save</button>
        </div>
      </form>
      <div v-else-if="deleting === team.id" class="confirm-row">
        <span>
          Delete {{ team.name }}? Its tasks, events, and Team Home are deleted too. Its people stay
          in the program without a team. Students keep their goals.
        </span>
        <span class="actions">
          <button type="button" class="small-button" @click="deleting = null">Cancel</button>
          <button type="button" class="small-button danger" :disabled="busy" @click="remove(team)">
            {{ busy ? 'Deleting…' : 'Delete team' }}
          </button>
        </span>
      </div>
      <div v-else class="settings-row">
        <TeamBadge :team="team" size="small" />
        <span class="who">
          <strong>{{ team.name }}</strong>
          <small>FTC {{ team.number }} · {{ team.sprintDays }}-day sprints</small>
        </span>
        <span class="people">
          {{ plural(studentsOf(team.id), 'student') }} ·
          <template v-if="mentorsOf(team.id).length"
            >Mentor{{ mentorsOf(team.id).length > 1 ? 's' : '' }}:
            {{ mentorsOf(team.id).join(', ') }}</template
          >
          <span v-else class="warn">No mentor yet</span>
        </span>
        <RouterLink
          class="link-button"
          :to="{ name: 'team', params: { teamId: team.id, tab: 'board' } }"
          >Open →</RouterLink
        >
        <button type="button" class="link-button" @click="startForm(team)">Edit</button>
        <button type="button" class="link-button danger" @click="deleting = team.id">Delete</button>
      </div>
    </template>
    <template v-if="inactive.length">
      <button
        type="button"
        class="link-button toggle"
        :aria-expanded="showInactive"
        @click="showInactive = !showInactive"
      >
        {{ showInactive ? '▾' : '▸' }} Not in this season ({{ inactive.length }})
      </button>
      <div
        v-for="team in showInactive ? inactive : []"
        :key="team.id"
        class="settings-row inactive"
      >
        <TeamBadge :team="team" size="small" />
        <span class="who"
          ><strong>{{ team.name }}</strong
          ><small>FTC {{ team.number }}</small></span
        >
        <button type="button" class="link-button" @click="bringBack(team)">
          Add to {{ season.name }}
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.who {
  display: grid;
  flex: 0 0 220px;
  min-width: 0;
}
.who strong {
  font-size: 14px;
}
.who small {
  color: #737d86;
  font-size: 12px;
}
.people {
  flex: 1;
  color: #59636d;
  font-size: 13px;
}
.warn {
  color: #a45c0a;
  font-weight: 650;
}
.toggle {
  margin-top: 10px;
  font-weight: 650;
}
.inactive {
  opacity: 0.8;
}
.inactive .who {
  flex: 1;
}
</style>
