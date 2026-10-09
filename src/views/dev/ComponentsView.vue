<script setup lang="ts">
// Dev only (/dev/components, not in production builds): every shared component with sample data, for checking
// them by eye and from the browser tests. No sign-in or Firestore needed.
import { onMounted, ref } from 'vue'
import type { Status, Subteam, TaskType } from '@/model/types'
import { teamAccent } from '@/ui/teamColor'
import { useToast } from '@/stores/toast'
import AssigneePicker from '@/components/ui/AssigneePicker.vue'
import AudienceChips from '@/components/ui/AudienceChips.vue'
import AvatarStack from '@/components/ui/AvatarStack.vue'
import DateButton from '@/components/ui/DateButton.vue'
import EditableTitle from '@/components/ui/EditableTitle.vue'
import MultiFilter from '@/components/ui/MultiFilter.vue'
import RichEditor from '@/components/ui/RichEditor.vue'
import SelectButton from '@/components/ui/SelectButton.vue'
import StatusChip from '@/components/ui/StatusChip.vue'
import SubteamTags from '@/components/ui/SubteamTags.vue'
import TeamChip from '@/components/ui/TeamChip.vue'
import TeamPicker from '@/components/ui/TeamPicker.vue'
import TypeLabel from '@/components/ui/TypeLabel.vue'

onMounted(() =>
  Object.entries(teamAccent('green')).forEach(([name, value]) =>
    document.documentElement.style.setProperty(name, value),
  ),
)

const subteams: Subteam[] = [
  { id: 'mechanical', name: 'Mechanical', color: 'red', description: '' },
  { id: 'software', name: 'Software', color: 'green', description: '' },
  { id: 'outreach', name: 'Outreach', color: 'purple', description: '' },
  { id: 'competition-ops', name: 'Competition Ops', color: 'blue', description: '' },
  { id: 'drive-team', name: 'Drive Team', color: 'teal', description: '' },
]
const people = ['Avery K.', 'Jordan M.', 'Sam R.', 'Mina L.', 'Priya S.', 'Leo W.'].map((name) => ({
  id: name
    .toLowerCase()
    .replace(/[^a-z]+/g, '-')
    .replace(/-$/, ''),
  displayName: name,
}))
const teams = [
  { id: 'circuit-breakers', name: 'Circuit Breakers', color: 'green' },
  { id: 'gear-grinders', name: 'Gear Grinders', color: 'orange' },
  { id: 'pixel-pilots', name: 'Pixel Pilots', color: 'pink' },
  { id: 'iron-owls', name: 'Iron Owls', color: 'navy' },
]
const teamsById = Object.fromEntries(teams.map((team) => [team.id, team]))

const STATUSES: Status[] = ['To do', 'In progress', 'Done']
const status = ref<Status>('In progress')
const subteamIds = ref<string[]>(['mechanical'])
const type = ref<TaskType>('Task')
const due = ref<string | null>('2026-10-14')
const assignees = ref<string[]>(['avery-k'])
const title = ref('Prototype claw fingers')
const studentTeam = ref<string[]>(['circuit-breakers'])
const mentorTeams = ref<string[]>(['gear-grinders', 'pixel-pilots'])
const statusFilter = ref<string[]>([])
const html = ref('<p>Build night is <strong>Thursday</strong>. Bring safety glasses.</p>')
const log = ref<string[]>([])
const note = (line: string) => (log.value = [line, ...log.value].slice(0, 6))
const toast = useToast()
</script>

<template>
  <main class="gallery">
    <h1>Shared components</h1>

    <section>
      <h2>Chips</h2>
      <div class="row">
        <StatusChip v-for="value in STATUSES" :key="value" :status="value" />
        <SubteamTags :subteams="subteams" :ids="['software', 'mechanical']" />
        <SubteamTags :subteams="subteams" :ids="[]" />
        <TypeLabel type="Learning" />
        <TypeLabel type="GitHub issue" />
      </div>
      <div class="row">
        <AvatarStack :names="[]" />
        <AvatarStack :names="['Avery K.', 'Jordan M.']" />
        <AvatarStack :names="['Avery K.', 'Jordan M.', 'Sam R.', 'Mina L.', 'Leo W.']" />
        <TeamChip :team="teams[1]!" />
        <AudienceChips :audience="['all']" :teams="teamsById" />
        <AudienceChips :audience="['circuit-breakers', 'iron-owls']" :teams="teamsById" />
      </div>
    </section>

    <section>
      <h2>Fields</h2>
      <div class="row" data-test="fields">
        <SelectButton
          v-model="status"
          data-test="status"
          label="Status"
          :options="STATUSES.map((value) => ({ value, label: value }))"
          @update:model-value="note(`status → ${$event}`)"
        >
          <template #value="{ value }"><StatusChip :status="value as Status" /></template>
          <template #option="{ option }"><StatusChip :status="option.value" /></template>
        </SelectButton>
        <SelectButton
          v-model="subteamIds"
          data-test="subteams"
          label="Subteams"
          multiple
          :options="subteams.map((s) => ({ value: s.id, label: s.name }))"
          @update:model-value="note(`subteams → ${($event as string[]).join(', ')}`)"
        >
          <template #value="{ value }"
            ><SubteamTags :subteams="subteams" :ids="value as string[]"
          /></template>
          <template #option="{ option }"
            ><SubteamTags :subteams="subteams" :ids="[option.value]"
          /></template>
        </SelectButton>
        <SelectButton
          v-model="type"
          data-test="type"
          label="Type"
          :options="
            (['Task', 'Learning', 'Idea'] as TaskType[]).map((value) => ({ value, label: value }))
          "
        />
        <DateButton
          v-model="due"
          data-test="due"
          label="Due date"
          placeholder="Due date"
          min="2026-10-05"
          :range="{ start: '2026-10-02', end: '2026-10-17', name: 'Sprint 3' }"
          @update:model-value="note(`due → ${$event}`)"
        />
      </div>
      <div class="row">
        <div class="wide">
          <AssigneePicker
            v-model="assignees"
            :people="people"
            @update:model-value="note(`assignees → ${$event.join(', ')}`)"
          />
        </div>
      </div>
      <div class="row">
        <EditableTitle
          :title="title"
          data-test="title"
          @save="((title = $event), note(`title → ${$event}`))"
          @open="note('open panel')"
        />
      </div>
    </section>

    <section>
      <h2>Pickers and filters</h2>
      <div class="row">
        <TeamPicker
          v-model="studentTeam"
          data-test="student-team"
          label="Team"
          single
          :teams="teams"
          @update:model-value="note(`student team → ${$event.join(', ') || 'none'}`)"
        />
        <TeamPicker
          v-model="mentorTeams"
          data-test="mentor-teams"
          label="Teams"
          :teams="teams"
          @update:model-value="note(`mentor teams → ${$event.join(', ')}`)"
        />
        <MultiFilter
          v-model="statusFilter"
          data-test="status-filter"
          label="Status"
          all-label="Any status"
          :options="STATUSES"
          @update:model-value="note(`filter → ${$event.join(', ') || 'any'}`)"
        />
      </div>
    </section>

    <section>
      <h2>Rich text</h2>
      <div class="editor-box">
        <RichEditor v-model="html" placeholder="Team notes…" label="Team notes" />
      </div>
      <pre class="html">{{ html }}</pre>
    </section>

    <section>
      <h2>Toast</h2>
      <div class="row">
        <button class="quiet-button" type="button" @click="toast.show('Saved')">Show toast</button>
        <button
          class="quiet-button"
          type="button"
          @click="toast.show('Task archived', { label: 'Undo', run: () => note('undo') })"
        >
          Toast with Undo
        </button>
      </div>
    </section>

    <section>
      <h2>Events</h2>
      <ol class="log" data-test="log">
        <li v-for="(line, i) in log" :key="i">{{ line }}</li>
      </ol>
    </section>
  </main>
</template>

<style scoped>
.gallery {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px 80px;
}
h1 {
  font-size: 22px;
}
h2 {
  margin: 0 0 10px;
  color: #59636d;
  font-size: 13px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}
section {
  margin-bottom: 28px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.wide {
  width: min(420px, 100%);
}
.editor-box {
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.html,
.log {
  color: #59636d;
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
