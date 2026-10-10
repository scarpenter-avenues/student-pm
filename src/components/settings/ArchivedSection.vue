<script setup lang="ts">
// Archived tasks: hidden everywhere but kept with their subtasks and comments. Anyone on the team restores them;
// mentors and coaches can delete one for good.
import { computed, ref } from 'vue'
import { queries, useLiveQuery, writes } from '@/data'
import type { TeamData } from '@/composables/useTeamData'
import { useToast } from '@/stores/toast'
import { formatMoment } from '@/ui/format'
import SubteamTags from '@/components/ui/SubteamTags.vue'
import TypeLabel from '@/components/ui/TypeLabel.vue'

const props = defineProps<{ team: TeamData }>()
const toast = useToast()
const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)
const teamId = computed(() => props.team.teamId.value!)
const archived = useLiveQuery(
  () => props.team.teamId.value && queries.archivedTasks(props.team.teamId.value),
)
const list = computed(() =>
  [...archived.data.value].sort(
    (a, b) => (b.archived?.at?.toMillis() ?? 0) - (a.archived?.at?.toMillis() ?? 0),
  ),
)
const confirming = ref<string | null>(null)

function restore(id: string, title: string) {
  writes.restoreTask(teamId.value, id).catch(fail)
  toast.show(`Restored “${title}”`)
}
function remove(id: string, title: string) {
  writes.deleteTask(teamId.value, id).catch(fail)
  confirming.value = null
  toast.show(`Deleted “${title}”`)
}
</script>

<template>
  <section class="settings-section">
    <header>
      <div>
        <h3>Archived tasks</h3>
        <p>
          Archived tasks are hidden everywhere but keep their subtasks and comments. Anyone on the
          team can restore them. Deleting one is permanent.
        </p>
      </div>
    </header>
    <p v-if="!list.length && !archived.loading.value" class="muted">No archived tasks.</p>
    <template v-for="task in list" :key="task.id">
      <div v-if="confirming === task.id" class="confirm-row">
        <span>Delete “{{ task.title }}” for good? Its subtasks and comments go too.</span>
        <span class="actions">
          <button type="button" class="small-button" @click="confirming = null">Cancel</button>
          <button type="button" class="small-button danger" @click="remove(task.id, task.title)">
            Delete
          </button>
        </span>
      </div>
      <div v-else class="settings-row archived">
        <SubteamTags :subteams="team.subteams.value" :ids="task.subteamIds.slice(0, 1)" />
        <span class="copy">
          <strong>{{ task.title }}</strong>
          <small>
            <TypeLabel :type="task.type" /> · was in {{ task.archived?.from }} · archived by
            {{ team.nameOf(task.archived?.by ?? '') }}
            {{ formatMoment(task.archived?.at).replace(' · ', ' at ') }}
          </small>
        </span>
        <button type="button" class="link-button" @click="restore(task.id, task.title)">
          Restore
        </button>
        <button
          v-if="team.can.value.manage"
          type="button"
          class="link-button danger"
          @click="confirming = task.id"
        >
          Delete
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.copy {
  display: grid;
  flex: 1;
  min-width: 0;
}
.copy strong {
  font-size: 14px;
}
.copy small {
  color: #737d86;
  font-size: 12px;
}
</style>
