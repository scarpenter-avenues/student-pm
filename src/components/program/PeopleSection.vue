<script setup lang="ts">
// People: everyone in the program (and people added who haven't signed in yet), grouped: Program coaches, each team
// (mentors first; a mentor on several teams appears under each), then No team. Filter by team, search by name.
// Role and team read as plain text until the row is hovered or focused. Changing someone's team takes them off the
// old team's tasks; goals follow the student. You can't change your own role or remove yourself.
import { computed, ref } from 'vue'
import { admin, writes } from '@/data'
import { signInMethodFor } from '@/model/signIn'
import {
  ADULT_ROLES,
  ROLE_LABELS,
  type Invite,
  type Member,
  type Role,
  type Team,
  type WithId,
} from '@/model/types'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import { initials, plural } from '@/ui/format'
import TeamBadge from '@/components/TeamBadge.vue'
import SelectButton from '@/components/ui/SelectButton.vue'
import TeamPicker from '@/components/ui/TeamPicker.vue'
import CsvImport from './CsvImport.vue'

const props = defineProps<{
  teams: readonly WithId<Team>[]
  members: readonly WithId<Member>[]
  invites: readonly WithId<Invite>[]
}>()
const session = useSession()
const toast = useToast()
const fail = (e: Error) => toast.show(`Couldn't save: ${e.message}`)

interface Person {
  id: string
  name: string
  role: Role
  teamIds: string[]
  member: WithId<Member> | null
  invite: WithId<Invite> | null
}
const people = computed<Person[]>(() => [
  ...props.members.map((m) => ({
    id: m.id,
    name: m.displayName,
    role: m.role,
    teamIds: m.teamIds,
    member: m,
    invite: null,
  })),
  ...props.invites.map((i) => ({
    id: `invite:${i.id}`,
    name: i.displayName,
    role: i.role,
    teamIds: i.teamIds,
    member: null,
    invite: i,
  })),
])
const ORDER: Role[] = ['coach', 'mentor', 'lead', 'student']
const byRole = (a: Person, b: Person) =>
  ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || a.name.localeCompare(b.name)

const filter = ref('all')
const search = ref('')
const collapsed = ref<Set<string>>(new Set())
const groups = computed(() => {
  const query = search.value.trim().toLowerCase()
  const matches = (p: Person) => !query || p.name.toLowerCase().includes(query)
  const list = [
    {
      key: 'coaches',
      label: 'Program coaches',
      team: null as WithId<Team> | null,
      people: people.value.filter((p) => p.role === 'coach'),
    },
    ...props.teams.map((team) => ({
      key: team.id,
      label: team.name,
      team,
      people: people.value.filter((p) => p.role !== 'coach' && p.teamIds.includes(team.id)),
    })),
    {
      key: 'none',
      label: 'No team',
      team: null,
      people: people.value.filter(
        (p) => p.role !== 'coach' && !p.teamIds.some((id) => props.teams.some((t) => t.id === id)),
      ),
    },
  ]
  return list
    .filter((g) => filter.value === 'all' || g.key === filter.value)
    .map((g) => ({ ...g, people: g.people.filter(matches).sort(byRole) }))
    .filter((g) => g.people.length || (filter.value === g.key && g.key !== 'coaches'))
})
const total = computed(() => people.value.length)
const noTeam = computed(
  () => people.value.filter((p) => p.role !== 'coach' && !p.teamIds.length).length,
)
function toggleGroup(key: string) {
  const next = new Set(collapsed.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsed.value = next
}
const isOpen = (key: string) =>
  !!search.value.trim() || filter.value !== 'all' || !collapsed.value.has(key)

const roleOptions = (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}))
const self = (p: Person) => p.member?.id === session.member?.id

function setRole(p: Person, role: Role) {
  // Coaches cover every team; someone leaving the mentor role keeps only their first team.
  const teamIds = role === 'coach' ? [] : role !== 'mentor' ? p.teamIds.slice(0, 1) : p.teamIds
  if (p.invite) return writes.saveInvite({ ...p.invite, role, teamIds }).catch(fail)
  if (!p.member) return
  writes.updateMember(p.member.id, { role }).catch(fail)
  if (teamIds.join() !== p.teamIds.join()) admin.setTeams(p.member, teamIds).catch(fail)
}
function setTeams(p: Person, teamIds: string[]) {
  if (p.invite) return writes.saveInvite({ ...p.invite, teamIds, subteams: {} }).catch(fail)
  if (p.member) admin.setTeams(p.member, teamIds).catch(fail)
}
const confirming = ref<string | null>(null)
function remove(p: Person) {
  confirming.value = null
  if (p.invite) writes.deleteInvite(p.invite.email).catch(fail)
  else if (p.member) admin.removeFromProgram(p.member).catch(fail)
  toast.show(`${p.name} removed from the program`)
}

// ---------- add person ----------
const adding = ref(false)
const draft = ref({ name: '', email: '', role: 'student' as Role, teamIds: [] as string[] })
const error = ref('')
function startAdd() {
  draft.value = {
    name: '',
    email: '',
    role: 'student',
    teamIds:
      filter.value !== 'all' && filter.value !== 'none' && filter.value !== 'coaches'
        ? [filter.value]
        : [],
  }
  error.value = ''
  adding.value = true
}
function add() {
  const name = draft.value.name.replace(/\s+/g, ' ').trim()
  const email = draft.value.email.trim().toLowerCase()
  if (!name) return (error.value = 'Add a display name (first name and last initial).')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return (error.value = "That doesn't look like an email address.")
  if (session.signIn && !signInMethodFor(session.signIn.auth, email, draft.value.role))
    return (error.value =
      "This email can't sign in to this program with that role. Check the program's sign-in settings.")
  if (props.invites.some((i) => i.email === email))
    return (error.value = 'That email has already been added.')
  const teamIds = draft.value.role === 'coach' ? [] : draft.value.teamIds
  writes
    .saveInvite({ email, displayName: name, role: draft.value.role, teamIds, subteams: {} })
    .catch(fail)
  adding.value = false
  toast.show(`Added ${name}. They join when they first sign in.`)
}
const importing = ref(false)
</script>

<template>
  <section class="settings-section">
    <header>
      <div>
        <h3>People</h3>
        <p>{{ plural(total, 'person', 'people') }} · {{ noTeam }} without a team</p>
      </div>
      <span class="head-actions">
        <button type="button" class="small-button" @click="importing = true">Import CSV</button>
        <button v-if="!adding" type="button" class="small-button" @click="startAdd">
          ＋ Add person
        </button>
      </span>
    </header>

    <form v-if="adding" class="inline-form" @submit.prevent="add">
      <div class="form-row">
        <label class="settings-field"
          >Display name
          <input v-model="draft.name" maxlength="40" placeholder="First name and last initial"
        /></label>
        <label class="settings-field"
          >Email
          <input
            v-model="draft.email"
            type="email"
            placeholder="Their sign-in email"
            autocomplete="off"
        /></label>
      </div>
      <div class="form-row">
        <span class="settings-field">
          Role
          <SelectButton v-model="draft.role" label="Role" :options="roleOptions">
            <template #value="{ value }">{{ ROLE_LABELS[value as Role] }}</template>
          </SelectButton>
        </span>
        <span class="settings-field">
          Team
          <span v-if="draft.role === 'coach'" class="muted">All teams</span>
          <TeamPicker
            v-else
            v-model="draft.teamIds"
            label="Team"
            :single="draft.role !== 'mentor'"
            :teams="teams"
          />
        </span>
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="small-button" @click="adding = false">Cancel</button>
        <button type="submit" class="small-button primary">Add person</button>
      </div>
    </form>

    <div class="filters">
      <SelectButton
        v-model="filter"
        class="filter"
        label="Team"
        :options="[
          { value: 'all', label: 'Everyone' },
          { value: 'coaches', label: 'Program coaches' },
          ...teams.map((t) => ({ value: t.id, label: t.name })),
          { value: 'none', label: 'No team' },
        ]"
      >
        <template #value="{ value }">
          {{
            value === 'all'
              ? 'Everyone'
              : value === 'none'
                ? 'No team'
                : value === 'coaches'
                  ? 'Program coaches'
                  : teams.find((t) => t.id === value)?.name
          }}
        </template>
      </SelectButton>
      <label class="search">
        <span aria-hidden="true">⌕</span>
        <input
          v-model="search"
          type="search"
          placeholder="Find a person"
          aria-label="Find a person"
        />
      </label>
    </div>

    <div v-for="group in groups" :key="group.key" class="group">
      <button
        type="button"
        class="group-head"
        :aria-expanded="isOpen(group.key)"
        @click="toggleGroup(group.key)"
      >
        <span class="arrow" aria-hidden="true">▾</span>
        <TeamBadge v-if="group.team" :team="group.team" size="small" />
        <strong>{{ group.label }}</strong>
        <small>{{ plural(group.people.length, 'person', 'people') }}</small>
      </button>
      <template v-if="isOpen(group.key)">
        <template v-for="person in group.people" :key="`${group.key}-${person.id}`">
          <div v-if="confirming === person.id" class="confirm-row">
            <span>Remove {{ person.name }} from the program? They come off their tasks.</span>
            <span class="actions">
              <button type="button" class="small-button" @click="confirming = null">Cancel</button>
              <button type="button" class="small-button danger" @click="remove(person)">
                Remove
              </button>
            </span>
          </div>
          <div v-else class="settings-row person" tabindex="-1">
            <span class="avatar">{{ initials(person.name) }}</span>
            <span class="who">
              <strong>{{ person.name }}</strong>
              <small v-if="person.invite">Hasn't signed in yet</small>
            </span>
            <span class="role">
              <span v-if="self(person)" class="plain">{{ ROLE_LABELS[person.role] }}</span>
              <SelectButton
                v-else
                class="hover-field"
                :model-value="person.role"
                :label="`Role of ${person.name}`"
                :options="roleOptions"
                @update:model-value="setRole(person, $event as Role)"
              >
                <template #value="{ value }">{{ ROLE_LABELS[value as Role] }}</template>
              </SelectButton>
            </span>
            <span class="team">
              <span v-if="person.role === 'coach'" class="plain">All teams</span>
              <TeamPicker
                v-else
                class="hover-field"
                :model-value="person.teamIds"
                :label="`Team of ${person.name}`"
                :single="!ADULT_ROLES.includes(person.role)"
                :teams="teams"
                @update:model-value="setTeams(person, $event)"
              />
            </span>
            <button
              v-if="!self(person)"
              type="button"
              class="link-button danger"
              @click="confirming = person.id"
            >
              Remove
            </button>
          </div>
        </template>
      </template>
    </div>

    <CsvImport
      v-if="importing"
      :teams="teams"
      :default-team-id="teams.some((t) => t.id === filter) ? filter : null"
      :existing-names="members.map((m) => m.displayName)"
      :existing-emails="invites.map((i) => i.email)"
      :auth="session.signIn?.auth ?? null"
      @close="importing = false"
    />
  </section>
</template>

<style scoped>
.head-actions {
  display: flex;
  gap: 6px;
}
.filters {
  display: flex;
  gap: 7px;
  margin-bottom: 8px;
}
.filter {
  min-width: 150px;
  min-height: 32px;
}
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: #8a949c;
}
.search input {
  width: 200px;
  border: 0;
  outline: none;
  font-size: 13px;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 14px;
  padding: 4px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  text-align: left;
}
.group-head strong {
  font-size: 13px;
}
.group-head small {
  margin-left: auto;
  color: #8a949c;
  font-size: 12px;
}
.arrow {
  color: #737d86;
  font-size: 10px;
  transition: transform 0.15s;
}
.group-head[aria-expanded='false'] .arrow {
  transform: rotate(-90deg);
}
.avatar {
  display: inline-grid;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: #e2ece6;
  color: #27654f;
  font-size: 9px;
  font-weight: 800;
}
.who {
  display: grid;
  flex: 1;
  min-width: 0;
}
.who strong {
  font-size: 13px;
}
.who small {
  color: #a45c0a;
  font-size: 11px;
}
.role {
  flex: 0 0 150px;
}
.team {
  flex: 0 0 200px;
}
.plain {
  color: #59636d;
  font-size: 13px;
}
/* Role and team read as plain text until the row is hovered or focused. */
.person :deep(.hover-field) {
  border-color: transparent;
  background-color: transparent;
  background-image: none;
  color: #59636d;
}
.person:hover :deep(.hover-field),
.person:focus-within :deep(.hover-field) {
  border-color: var(--line);
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238a949c' stroke-width='1.6'/%3E%3C/svg%3E");
}
.person .link-button {
  opacity: 0;
}
.person:hover .link-button,
.person:focus-within .link-button {
  opacity: 1;
}
@media (hover: none) {
  .person .link-button {
    opacity: 1;
  }
}
</style>
