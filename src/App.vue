<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSession } from '@/stores/session'
import { decide } from '@/router/access'
import ToastHost from '@/components/ui/ToastHost.vue'

const session = useSession()
const route = useRoute()
const router = useRouter()
void session.start()

// The guard runs on navigation; this re-runs it when the session changes under the current page
// (signing in finishes, a coach changes your role or team, you're removed from the program).
watch(
  () => [session.phase, session.member?.role, session.member?.teamIds.join('|')],
  () => {
    if (session.phase === 'starting' || session.phase === 'joining') return
    if (!route.matched.length) return
    const result = decide(route, { phase: session.phase, member: session.member })
    if (result !== true) void router.replace(result)
  },
)
</script>

<template>
  <RouterView />
  <ToastHost />
</template>
