<script setup lang="ts">
// At sign-in, coaches and mentors see the newest unread huddles and quick notes (up to 3). Later hides them for this
// browser session; Got it marks them read; See all huddles opens the page (which marks everything read).
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHuddles } from '@/composables/useInbox'
import { useNames } from '@/composables/useNames'
import { useTeam } from '@/composables/useTeamData'
import { useSession } from '@/stores/session'
import { formatEventDate } from '@/ui/format'
import RichText from '@/components/ui/RichText.vue'

const KEY = 'switchback.huddleLater'
const session = useSession()
const route = useRoute()
const router = useRouter()
const { unread, markRead } = useHuddles()
const { nameOf } = useNames(useTeam())

function laterIds(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}
const later = ref(laterIds())
const onHuddlePage = computed(
  () => route.name === 'huddle' || (route.name === 'dashboard' && route.params.tab === 'huddle'),
)
const items = computed(() =>
  unread.value.filter((item) => !later.value.includes(item.id)).slice(0, 3),
)
const shown = computed(() => session.isAdult && !onHuddlePage.value && items.value.length > 0)

function dismiss() {
  later.value = [...later.value, ...items.value.map((item) => item.id)]
  try {
    sessionStorage.setItem(KEY, JSON.stringify(later.value))
  } catch {
    // Private windows can refuse storage; it just shows again next time.
  }
}
function gotIt() {
  void markRead(items.value.map((item) => item.id))
}
function seeAll() {
  void router.push(
    session.isCoach ? { name: 'dashboard', params: { tab: 'huddle' } } : { name: 'huddle' },
  )
}
</script>

<template>
  <div v-if="shown" class="popup-backdrop">
    <section
      class="popup"
      role="dialog"
      aria-modal="true"
      aria-labelledby="huddle-popup-title"
      @keydown.esc="dismiss"
    >
      <h2 id="huddle-popup-title">
        {{ items.length === 1 ? 'New huddle' : `${items.length} new huddle updates` }}
      </h2>
      <article v-for="item in items" :key="item.id" class="entry">
        <p class="entry-head">
          <strong
            >{{ item.kind === 'note' ? 'Quick note' : 'Huddle' }} ·
            {{ formatEventDate(item.date) }}</strong
          >
          <small>{{ nameOf(item.authorId) }}</small>
        </p>
        <RichText
          v-if="item.kind === 'note' ? item.textHtml : item.statusHtml"
          :html="(item.kind === 'note' ? item.textHtml : item.statusHtml)!"
        />
        <p v-else class="plain">{{ item.kind === 'note' ? item.text : item.status }}</p>
        <p v-if="item.plan?.length" class="plan-count">Plan: {{ item.plan.length }} items</p>
      </article>
      <div class="actions">
        <button type="button" @click="dismiss">Later</button>
        <button type="button" @click="seeAll">See all huddles</button>
        <button type="button" class="primary" @click="gotIt">Got it</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.popup-backdrop {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(22, 32, 29, 0.28);
}
.popup {
  display: grid;
  gap: 12px;
  width: min(520px, 100%);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding: 20px 22px;
  border-radius: 12px;
  background: #fff;
  box-shadow: var(--shadow);
}
h2 {
  margin: 0;
  font-size: 18px;
}
.entry {
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.entry-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 4px;
}
.entry-head strong {
  font-size: 13px;
}
.entry-head small,
.plan-count {
  color: #8a949c;
  font-size: 12px;
}
.plain,
.plan-count {
  margin: 0;
}
.entry :deep(.rich-content) {
  min-height: 0;
  font-size: 14px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.actions button {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
}
.actions .primary {
  border-color: #356fd1;
  background: #356fd1;
  color: #fff;
  font-weight: 650;
}
</style>
