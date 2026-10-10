<script setup lang="ts">
// Goal ideas: the chips students can tap in each set-a-goal step. A list the program hasn't changed uses the
// built-in defaults; Reset goes back to them.
import { reactive, ref } from 'vue'
import { writes } from '@/data'
import {
  DEFAULT_GOAL_IDEAS,
  GOAL_IDEA_KEYS,
  MAX_GOAL_IDEAS,
  MAX_GOAL_IDEA_LENGTH,
  cleanText,
  goalIdeasFor,
} from '@/model/goals'
import type { GoalIdeaKey, Program } from '@/model/types'
import { useToast } from '@/stores/toast'
import { plural } from '@/ui/format'

const props = defineProps<{ program: Program | null }>()
const toast = useToast()

const LISTS: Record<GoalIdeaKey, { title: string; hint: string }> = {
  wish: { title: 'What to learn', hint: 'Start with a verb, like Learn, Design, or Create.' },
  evidence: { title: "How they'll know they've got it", hint: '' },
  obstacle: { title: 'What might get in the way', hint: '' },
  plan: { title: 'If-then plans', hint: 'The “then I will…” part.' },
  firstStep: { title: 'First steps', hint: 'Use ___ for a blank the student fills in.' },
}
const drafts = reactive<Record<GoalIdeaKey, string>>({
  wish: '',
  evidence: '',
  obstacle: '',
  plan: '',
  firstStep: '',
})

// Every list starts collapsed; the section is long otherwise.
const open = ref<Set<GoalIdeaKey>>(new Set())
function toggle(key: GoalIdeaKey) {
  const next = new Set(open.value)
  if (!next.delete(key)) next.add(key)
  open.value = next
}

const ideas = (key: GoalIdeaKey) => goalIdeasFor(props.program, key)
const customized = (key: GoalIdeaKey) => !!props.program?.goalIdeas?.[key]

function save(key: GoalIdeaKey, next: string[] | null) {
  writes.setGoalIdeas(key, next).catch((e: Error) => toast.show(`Couldn't save: ${e.message}`))
}
function add(key: GoalIdeaKey) {
  const text = cleanText(drafts[key])
  if (!text) return
  const list = ideas(key)
  if (list.some((idea) => idea.toLowerCase() === text.toLowerCase()))
    return toast.show("That idea's already on the list")
  if (list.length >= MAX_GOAL_IDEAS)
    return toast.show(`Keep it to ${MAX_GOAL_IDEAS} ideas or fewer`)
  save(key, [...list, text])
  drafts[key] = ''
}
function remove(key: GoalIdeaKey, idea: string) {
  save(
    key,
    ideas(key).filter((i) => i !== idea),
  )
}
</script>

<template>
  <section class="settings-section">
    <header>
      <div>
        <h3>Goal ideas</h3>
        <p>
          Students can tap these while setting a goal, then make them their own. Change them to fit
          your program.
        </p>
      </div>
    </header>
    <div v-for="key in GOAL_IDEA_KEYS" :key="key">
      <button type="button" class="group-head" :aria-expanded="open.has(key)" @click="toggle(key)">
        <span class="arrow" aria-hidden="true">▾</span>
        <strong>{{ LISTS[key].title }}</strong>
        <small>{{ plural(ideas(key).length, 'idea') }}</small>
      </button>
      <template v-if="open.has(key)">
        <div v-if="LISTS[key].hint || customized(key)" class="idea-note">
          <small>{{ LISTS[key].hint }}</small>
          <button
            v-if="customized(key)"
            type="button"
            class="link-button"
            :title="`Go back to the ${DEFAULT_GOAL_IDEAS[key].length} built-in ideas`"
            @click="save(key, null)"
          >
            Reset
          </button>
        </div>
        <ul class="ideas">
          <li v-for="idea in ideas(key)" :key="idea" class="idea">
            {{ idea }}
            <button type="button" :aria-label="`Remove “${idea}”`" @click="remove(key, idea)">
              ×
            </button>
          </li>
          <li v-if="ideas(key).length < MAX_GOAL_IDEAS" class="idea-add">
            <input
              v-model="drafts[key]"
              class="settings-input"
              :maxlength="MAX_GOAL_IDEA_LENGTH"
              placeholder="Add an idea…"
              :aria-label="`Add an idea to ${LISTS[key].title}`"
              @keydown.enter.prevent="add(key)"
              @keydown.esc="drafts[key] = ''"
            />
          </li>
        </ul>
        <p v-if="!ideas(key).length" class="muted">No ideas: students see an empty box here.</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
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
.idea-note {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 8px 0 0;
}
.idea-note small {
  color: #737d86;
  font-size: 12px;
}
.idea-note .link-button {
  margin-left: auto;
}
.ideas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.idea {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 4px 3px 10px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  color: #2c343b;
  font-size: 13px;
}
.idea button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: #8a949c;
  font-size: 15px;
  line-height: 1;
}
.idea button:hover,
.idea button:focus-visible {
  background: #eef1f4;
  color: #202124;
}
.idea-add .settings-input {
  width: 200px;
  height: 28px;
  padding: 3px 10px;
  border-radius: 14px;
  font-size: 13px;
}
.muted {
  margin: 6px 0 0;
}
</style>
