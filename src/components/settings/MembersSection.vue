<script setup lang="ts">
// The team's members: name, role, subteams. No emails are shown. Mentors and program coaches add people (an email
// is required, to match their sign-in) and change roles; leads change subteam assignments. People who haven't signed
// in yet show as such. Removing someone takes them off the team's tasks.
import { computed, ref } from 'vue'
import { queries, useLiveQuery, writes } from '@/data'
import { signInMethodFor } from '@/model/signIn'
import { ADULT_ROLES, ROLE_LABELS, type Role } from '@/model/types'
import type { TeamData } from '@/composables/useTeamData'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import { initials } from '@/ui/format'
import SelectButton from '@/components/ui/SelectButton.vue'
import SubteamTags from '@/components/ui/SubteamTags.vue'

const props = defineProps<{ team: TeamData }>()
const session = useSession()
const toast = useToast()
const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)
const teamId = computed(() => props.team.teamId.value!)
const manage = computed(() => props.team.can.value.manage)
const invites = useLiveQuery(() => manage.value && queries.teamInvites(teamId.value))

const ORDER: Role[] = ['coach', 'mentor', 'lead', 'student']
const rows = computed(() =>
  [...props.team.members.value].sort(
    (a, b) =>
      ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || a.displayName.localeCompare(b.displayName),
  ),
)
/** Mentors manage students and leads; program coaches anyone (but not themselves, or coaches here). */
function canManage(role: Role, uid: string) {
  if (uid === session.member?.id || role === 'coach') return false
  return session.isCoach || (manage.value && !ADULT_ROLES.includes(role))
}
const roleOptions = computed(() =>
  (session.isCoach
    ? (['student', 'lead', 'mentor'] as Role[])
    : (['student', 'lead'] as Role[])
  ).map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  })),
)
function setRole(uid: string, role: Role) {
  writes.updateMember(uid, { role }).catch(fail)
}
function toggleSubteam(uid: string, current: readonly string[], subteamId: string) {
  const next = current.includes(subteamId)
    ? current.filter((id) => id !== subteamId)
    : [...current, subteamId]
  const order = props.team.subteams.value.map((s) => s.id).filter((id) => next.includes(id))
  const member = props.team.memberById.value.get(uid)
  writes
    .updateMember(uid, { subteams: { ...member?.subteams, [teamId.value]: order } })
    .catch(fail)
}

// ---------- remove ----------
const confirming = ref<string | null>(null)
function remove(uid: string) {
  const member = props.team.memberById.value.get(uid)
  if (!member) return
  const teamIds = member.teamIds.filter((id) => id !== teamId.value)
  const subteams = { ...member.subteams }
  delete subteams[teamId.value]
  writes.updateMember(uid, { teamIds, subteams }).catch(fail)
  // Off this team's tasks (and subtasks).
  props.team.tasks.value
    .filter(
      (task) =>
        task.assigneeIds.includes(uid) || task.subtasks.some((s) => s.assigneeIds.includes(uid)),
    )
    .forEach((task) =>
      writes
        .updateTask(teamId.value, task.id, {
          assigneeIds: task.assigneeIds.filter((id) => id !== uid),
          subtasks: task.subtasks.map((s) => ({
            ...s,
            assigneeIds: s.assigneeIds.filter((id) => id !== uid),
          })),
        })
        .catch(fail),
    )
  confirming.value = null
  toast.show(`${member.displayName} removed from ${props.team.team.value?.name}`)
}
function cancelInvite(email: string, name: string) {
  writes.deleteInvite(email).catch(fail)
  toast.show(`Removed ${name}'s invite`)
}

// ---------- add ----------
const adding = ref(false)
const draft = ref({ name: '', email: '', role: 'student' as Role, subteamIds: [] as string[] })
const error = ref('')
function startAdd() {
  draft.value = { name: '', email: '', role: 'student', subteamIds: [] }
  error.value = ''
  adding.value = true
}
function add() {
  const name = draft.value.name.replace(/\s+/g, ' ').trim()
  const email = draft.value.email.trim().toLowerCase()
  if (!name) return (error.value = 'Add a display name (first name and last initial).')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return (error.value = "That doesn't look like an email address.")
  const auth = session.signIn?.auth
  if (auth && !signInMethodFor(auth, email, draft.value.role)) {
    const domains = auth.google?.domains ?? []
    return (error.value = domains.length
      ? `This email can't sign in to this program. Use a ${domains.join(' or ')} address.`
      : "This email can't sign in to this program.")
  }
  writes
    .saveInvite({
      email,
      displayName: name,
      role: draft.value.role,
      teamIds: [teamId.value],
      subteams: draft.value.subteamIds.length ? { [teamId.value]: draft.value.subteamIds } : {},
    })
    .catch(fail)
  adding.value = false
  toast.show(`Added ${name}. They join when they first sign in.`)
}
</script>

<template>
  <section class="settings-section">
    <header>
      <div>
        <h3>Members</h3>
        <p>
          Mentors and coaches manage the roster. Emails are only used to match sign-ins and aren't
          shown here.
        </p>
      </div>
      <button v-if="manage && !adding" type="button" class="small-button" @click="startAdd">
        ＋ Add member
      </button>
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
          Subteams
          <span class="chips">
            <button
              v-for="subteam in team.subteams.value"
              :key="subteam.id"
              type="button"
              class="chip"
              :aria-pressed="draft.subteamIds.includes(subteam.id)"
              @click="
                draft.subteamIds = draft.subteamIds.includes(subteam.id)
                  ? draft.subteamIds.filter((id) => id !== subteam.id)
                  : [...draft.subteamIds, subteam.id]
              "
            >
              {{ subteam.name }}
            </button>
          </span>
        </span>
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button type="button" class="small-button" @click="adding = false">Cancel</button>
        <button type="submit" class="small-button primary">Add member</button>
      </div>
    </form>

    <template v-for="member in rows" :key="member.id">
      <div v-if="confirming === member.id" class="confirm-row">
        <span
          >Remove {{ member.displayName }} from {{ team.team.value?.name }}? They come off this
          team's tasks.</span
        >
        <span class="actions">
          <button type="button" class="small-button" @click="confirming = null">Cancel</button>
          <button type="button" class="small-button danger" @click="remove(member.id)">
            Remove
          </button>
        </span>
      </div>
      <div v-else class="settings-row member">
        <span class="avatar">{{ initials(member.displayName) }}</span>
        <strong class="name">{{ member.displayName }}</strong>
        <SelectButton
          v-if="canManage(member.role, member.id)"
          class="role"
          :model-value="member.role"
          :label="`Role of ${member.displayName}`"
          :options="roleOptions"
          @update:model-value="setRole(member.id, $event as Role)"
        >
          <template #value="{ value }">{{ ROLE_LABELS[value as Role] }}</template>
        </SelectButton>
        <span v-else class="role static">{{ ROLE_LABELS[member.role] }}</span>
        <span class="subteams">
          <span v-if="member.role === 'coach'" class="muted">All teams</span>
          <span v-else-if="member.role === 'mentor'" class="muted">All subteams</span>
          <template v-else-if="team.can.value.assignSubteams">
            <button
              v-for="subteam in team.subteams.value"
              :key="subteam.id"
              type="button"
              class="chip"
              :aria-pressed="(member.subteams[team.teamId.value!] ?? []).includes(subteam.id)"
              @click="
                toggleSubteam(member.id, member.subteams[team.teamId.value!] ?? [], subteam.id)
              "
            >
              {{ subteam.name }}
            </button>
          </template>
          <SubteamTags
            v-else
            :subteams="team.subteams.value"
            :ids="member.subteams[team.teamId.value!] ?? []"
          />
        </span>
        <button
          v-if="canManage(member.role, member.id)"
          type="button"
          class="link-button danger"
          @click="confirming = member.id"
        >
          Remove
        </button>
      </div>
    </template>
    <div v-for="invite in invites.data.value" :key="invite.id" class="settings-row member pending">
      <span class="avatar">{{ initials(invite.displayName) }}</span>
      <strong class="name">{{ invite.displayName }}</strong>
      <span class="role static">{{ ROLE_LABELS[invite.role] }}</span>
      <span class="subteams muted">Hasn't signed in yet</span>
      <button
        v-if="canManage(invite.role, '')"
        type="button"
        class="link-button danger"
        @click="cancelInvite(invite.email, invite.displayName)"
      >
        Remove
      </button>
    </div>
  </section>
</template>

<style scoped>
.member .avatar {
  display: inline-grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: #e2ece6;
  color: #27654f;
  font-size: 10px;
  font-weight: 800;
}
.name {
  flex: 0 0 200px;
  font-size: 14px;
}
.role {
  flex: 0 0 130px;
  min-height: 32px;
}
.role.static {
  color: #59636d;
  font-size: 13px;
}
.subteams {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 4px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  padding: 2px 8px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  color: #6b757e;
  font-size: 12px;
}
.chip[aria-pressed='true'] {
  border-color: var(--team-line);
  background: var(--team-soft);
  color: var(--team-ink);
  font-weight: 650;
}
.pending {
  opacity: 0.8;
}
@media (max-width: 680px) {
  .name {
    flex: 1 1 auto;
  }
}
</style>
