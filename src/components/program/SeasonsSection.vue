<script setup lang="ts">
// Seasons: current and past, with dates and team counts. The current season's dates open the calendar.
// "Start a new season…" opens the five-step wizard.
import { computed, ref } from 'vue'
import { doc, updateDoc } from 'firebase/firestore'
import { refs } from '@/data'
import type { Member, Season, Team, WithId } from '@/model/types'
import { useToast } from '@/stores/toast'
import { plural } from '@/ui/format'
import CalendarPopover from '@/components/ui/CalendarPopover.vue'
import NewSeasonWizard from './NewSeasonWizard.vue'
import { seasonDate } from './seasonDate'

const props = defineProps<{
  seasons: readonly WithId<Season>[]
  currentId: string
  allTeams: readonly WithId<Team>[]
  members: readonly WithId<Member>[]
}>()
const toast = useToast()
const sorted = computed(() => [...props.seasons].sort((a, b) => b.start.localeCompare(a.start)))
const current = computed(() => props.seasons.find((s) => s.id === props.currentId) ?? null)
const teamCount = (id: string) =>
  props.allTeams.filter((team) => team.seasonIds.includes(id)).length
const inSeason = computed(() => props.allTeams.filter((t) => t.seasonIds.includes(props.currentId)))
const inactive = computed(() =>
  props.allTeams.filter((t) => !t.seasonIds.includes(props.currentId)),
)

const editing = ref<{ edge: 'start' | 'end'; anchor: HTMLElement } | null>(null)
function pick(iso: string) {
  if (!current.value || !editing.value) return
  updateDoc(doc(refs.seasons(), current.value.id), { [editing.value.edge]: iso }).catch(
    (e: Error) => toast.show(`Couldn't save: ${e.message}`),
  )
  editing.value = null
}
const wizard = ref(false)
</script>

<template>
  <section class="settings-section">
    <header>
      <div><h3>Seasons</h3></div>
      <button v-if="current" type="button" class="small-button" @click="wizard = true">
        Start a new season…
      </button>
    </header>
    <div v-for="season in sorted" :key="season.id" class="settings-row">
      <strong class="name">{{ season.name }}</strong>
      <span v-if="season.id === currentId" class="current">Current</span>
      <span v-if="season.id === currentId" class="dates">
        <button
          type="button"
          class="date"
          aria-haspopup="dialog"
          @click="editing = { edge: 'start', anchor: $event.currentTarget as HTMLElement }"
        >
          {{ seasonDate(season.start) }}
        </button>
        –
        <button
          type="button"
          class="date"
          aria-haspopup="dialog"
          @click="editing = { edge: 'end', anchor: $event.currentTarget as HTMLElement }"
        >
          {{ seasonDate(season.end) }}
        </button>
      </span>
      <span v-else class="dates"
        >{{ seasonDate(season.start) }} – {{ seasonDate(season.end) }}</span
      >
      <span class="muted count">{{ plural(teamCount(season.id), 'team') }}</span>
    </div>
    <CalendarPopover
      v-if="editing && current"
      :anchor="editing.anchor"
      :label="`${current.name} ${editing.edge} date`"
      :selected="current[editing.edge]"
      :range="{ start: current.start, end: current.end, name: current.name }"
      :min="editing.edge === 'end' ? current.start : null"
      :max="editing.edge === 'start' ? current.end : null"
      @pick="pick"
      @close="editing = null"
    />
    <NewSeasonWizard
      v-if="wizard && current"
      :current="current"
      :teams="inSeason"
      :inactive="inactive"
      :members="members"
      @close="wizard = false"
    />
  </section>
</template>

<style scoped>
.name {
  flex: 0 0 90px;
  font-size: 14px;
}
.current {
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--team-soft);
  color: var(--team-ink);
  font-size: 11px;
  font-weight: 650;
}
.dates {
  color: #59636d;
  font-size: 13px;
}
.date {
  padding: 1px 3px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
}
.date:hover {
  border-color: #d5dce5;
  color: var(--team-ink);
}
.count {
  margin-left: auto;
}
</style>
