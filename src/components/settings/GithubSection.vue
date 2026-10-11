<script setup lang="ts">
// Connect the code team's GitHub repo (owner/repo or a github.com URL). Two options: new issues come into the
// Backlog as GitHub issue tasks; closing an issue marks its task Done. Leads, mentors, and coaches edit; others see the
// repo. The sync itself is a background job the program installs (docs/github.md); until it has, this says so.
import { computed, ref } from 'vue'
import { writes } from '@/data'
import type { GithubSettings, Team, WithId } from '@/model/types'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import SelectButton from '@/components/ui/SelectButton.vue'
import SubteamTags from '@/components/ui/SubteamTags.vue'

const props = defineProps<{ team: WithId<Team>; editable: boolean }>()
const toast = useToast()
const session = useSession()
const github = computed(() => props.team.github)
/** The program's GitHub sync is installed and running. */
const syncing = computed(() => !!session.program?.githubSync?.on)
/** The chosen subteams that still exist. */
const issueSubteams = computed(() =>
  (github.value.subteamIds ?? []).filter((id) => props.team.subteams.some((s) => s.id === id)),
)
const input = ref('')
const error = ref('')

/** "owner/repo", "https://github.com/owner/repo(.git)", "github.com/owner/repo/…" → "owner/repo". */
function parseRepo(value: string): string | null {
  const text = value.trim().replace(/\.git$/, '')
  const match =
    text.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i) ??
    text.match(/^([\w.-]+)\/([\w.-]+)$/)
  return match ? `${match[1]}/${match[2]}` : null
}
// The GitHub settings are stored as one object on the team, so a change saves the whole object.
function save(changes: Partial<GithubSettings>) {
  writes
    .updateTeam(props.team.id, { github: { ...github.value, ...changes } })
    .catch((e: Error) => toast.show(`Couldn't save: ${e.message}`))
}
// Connects the repo typed in the box, if it reads as owner/repo or a github.com link.
function connect() {
  const repo = parseRepo(input.value)
  if (!repo) return (error.value = 'Use owner/repo or a github.com link.')
  error.value = ''
  input.value = ''
  save({ repo })
  toast.show(`Connected ${repo}`)
}
</script>

<template>
  <section class="settings-section">
    <header>
      <div>
        <h3>GitHub</h3>
        <p>
          Connect the code team's repository. New issues come into the Backlog, and tasks finish
          when their issue is closed.
        </p>
      </div>
      <span v-if="!editable" class="edit-note"
        >🔒 Team leads, mentors, and coaches can change this</span
      >
    </header>
    <template v-if="github.repo">
      <div class="repo">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          />
        </svg>
        <a :href="`https://github.com/${github.repo}`" target="_blank" rel="noopener noreferrer">{{
          github.repo
        }}</a>
        <span class="connected" :class="{ waiting: !syncing }">{{
          syncing ? 'Syncing' : 'Connected'
        }}</span>
        <button v-if="editable" type="button" class="link-button" @click="save({ repo: null })">
          Disconnect
        </button>
      </div>
      <p v-if="!syncing" class="not-syncing">
        Nothing syncs yet: your program's GitHub sync isn't turned on. A program coach sets it up
        once for every team.
      </p>
      <label class="option">
        <input
          type="checkbox"
          :checked="github.importIssues"
          :disabled="!editable"
          @change="save({ importIssues: ($event.target as HTMLInputElement).checked })"
        />
        <span
          ><strong>Add new issues to the Backlog</strong
          ><small>They show as GitHub issue tasks.</small></span
        >
      </label>
      <div class="option subteam-option">
        <span
          ><strong>Subteam for new issues</strong
          ><small>The subteam each new issue's task starts in.</small></span
        >
        <SelectButton
          :model-value="issueSubteams"
          label="Subteam for new issues"
          placeholder="No subteam"
          multiple
          :disabled="!editable"
          :options="team.subteams.map((s) => ({ value: s.id, label: s.name }))"
          @update:model-value="save({ subteamIds: $event as string[] })"
        >
          <template #value="{ value }"
            ><SubteamTags :subteams="team.subteams" :ids="value as string[]"
          /></template>
          <template #option="{ option }"
            ><SubteamTags :subteams="team.subteams" :ids="[option.value as string]"
          /></template>
        </SelectButton>
      </div>
      <label class="option">
        <input
          type="checkbox"
          :checked="github.closeOnDone"
          :disabled="!editable"
          @change="save({ closeOnDone: ($event.target as HTMLInputElement).checked })"
        />
        <span
          ><strong>Mark the task Done when its issue is closed</strong
          ><small>Reopening the issue moves the task back to To do.</small></span
        >
      </label>
    </template>
    <form v-else-if="editable" class="connect" @submit.prevent="connect">
      <input
        v-model="input"
        class="settings-input"
        placeholder="owner/repo or https://github.com/owner/repo"
        aria-label="GitHub repository"
      />
      <button type="submit" class="small-button primary">Connect</button>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </form>
    <p v-else class="muted">No repository connected.</p>
  </section>
</template>

<style scoped>
.repo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
}
.repo a {
  color: #24292f;
  font-weight: 700;
  text-decoration: none;
}
.connected {
  padding: 1px 8px;
  border-radius: 10px;
  background: #e3f4ea;
  color: #227346;
  font-size: 12px;
  font-weight: 650;
}
.connected.waiting {
  background: #f0f2f4;
  color: #59636d;
}
.not-syncing {
  margin: 0 0 10px;
  color: #8a5a12;
  font-size: 13px;
}
.subteam-option {
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-left: 21px;
}
.option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}
.option span {
  display: grid;
  font-size: 14px;
}
.option small {
  color: #737d86;
  font-size: 12px;
}
.connect {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.connect input {
  width: min(420px, 100%);
}
.connect .form-error {
  flex-basis: 100%;
}
</style>
