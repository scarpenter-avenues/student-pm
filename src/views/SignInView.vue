<script setup lang="ts">
// Everything before the app opens: sign in (Google and/or email and password, per program), verify an email,
// "you're not in this program yet", and errors. Which one shows follows the session phase.
import { computed, onMounted, ref } from 'vue'
import { useSession } from '@/stores/session'
import { usingEmulators } from '@/firebase'

const session = useSession()
const loading = ref(true)
onMounted(async () => {
  try {
    await session.loadSignIn()
  } finally {
    loading.value = false
  }
})

const settings = computed(() => session.signIn)
const domains = computed(() => settings.value?.auth.google?.domains ?? [])
const google = computed(() => domains.value.length > 0)
const password = computed(() => !!settings.value?.auth.password)

type Mode = 'signIn' | 'create' | 'reset'
const mode = ref<Mode>('signIn')
const email = ref('')
const secret = ref('')
const error = ref('')
const info = ref('')
const busy = ref(false)

async function run(action: () => Promise<string | null>, done?: string) {
  busy.value = true
  error.value = ''
  info.value = ''
  try {
    const message = await action()
    if (message) error.value = message
    else if (done) info.value = done
  } finally {
    busy.value = false
  }
}

function submit() {
  const address = email.value.trim()
  if (mode.value === 'reset') {
    return run(
      () => session.resetPassword(address),
      `If there's an account for ${address}, a link to reset the password is on its way.`,
    )
  }
  return run(() =>
    mode.value === 'create'
      ? session.createPassword(address, secret.value)
      : session.signInWithPassword(address, secret.value),
  )
}

function setMode(next: Mode) {
  mode.value = next
  error.value = ''
  info.value = ''
}

async function checkVerified() {
  await run(async () =>
    (await session.checkVerified())
      ? null
      : "It isn't verified yet. Open the link in the email first.",
  )
}

const reload = () => window.location.reload()
const signedInAs = computed(() => session.user?.email ?? '')
</script>

<template>
  <main class="sign-in">
    <section class="card">
      <h1>{{ settings?.name ?? 'Switchback' }}</h1>

      <p v-if="loading || session.phase === 'starting'" class="muted">Loading…</p>

      <template v-else-if="session.phase === 'joining'">
        <p class="muted">Signing you in…</p>
      </template>

      <template v-else-if="session.phase === 'verifyEmail'">
        <h2>Check your email</h2>
        <p>
          We sent a link to <strong>{{ signedInAs }}</strong
          >. Open it, then come back here.
        </p>
        <p v-if="usingEmulators" class="note">
          Emulators: the link is printed in the terminal running them.
        </p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="info" class="info">{{ info }}</p>
        <div class="actions">
          <button class="primary-button" type="button" :disabled="busy" @click="checkVerified">
            I've verified it
          </button>
          <button
            class="quiet-button"
            type="button"
            :disabled="busy"
            @click="run(session.resendVerification, 'Sent. Check your email again.')"
          >
            Send it again
          </button>
        </div>
        <button class="text-button" type="button" @click="session.signOut()">
          Use a different account
        </button>
      </template>

      <template v-else-if="session.phase === 'noAccess'">
        <h2>You're not in {{ settings?.name ?? 'this program' }} yet</h2>
        <p v-if="session.notice">{{ session.notice }}</p>
        <p v-else>
          You're signed in as <strong>{{ signedInAs }}</strong
          >. Ask your coach to add this email, then sign in again.
        </p>
        <button class="quiet-button" type="button" @click="session.signOut()">Sign out</button>
      </template>

      <template v-else-if="session.phase === 'failed'">
        <h2>Something went wrong</h2>
        <p>{{ session.problem }}</p>
        <div class="actions">
          <button class="primary-button" type="button" @click="reload">Try again</button>
          <button class="quiet-button" type="button" @click="session.signOut()">Sign out</button>
        </div>
      </template>

      <template v-else-if="!settings">
        <p class="error">
          This program isn't set up yet. Run <code>npm run setup</code> (see docs/configuration.md).
        </p>
      </template>

      <template v-else>
        <p v-if="session.notice" class="error" role="alert">{{ session.notice }}</p>

        <template v-if="google">
          <button
            class="google-button"
            type="button"
            :disabled="busy"
            @click="run(session.signInWithGoogle)"
          >
            <!-- The Google "G" mark, as Google's sign-in branding guidelines ask. -->
            <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            Sign in with Google
          </button>
          <p class="muted hint">Use your {{ domains.join(' or ') }} account.</p>
        </template>

        <div v-if="google && password" class="divider"><span>or</span></div>

        <form v-if="password" class="password" @submit.prevent="submit">
          <p v-if="google" class="muted hint">Not on {{ domains.join(' or ') }}? Use your email.</p>
          <label>
            Email
            <input v-model="email" type="email" autocomplete="email" required />
          </label>
          <label v-if="mode !== 'reset'">
            {{ mode === 'create' ? 'Choose a password' : 'Password' }}
            <input
              v-model="secret"
              type="password"
              :autocomplete="mode === 'create' ? 'new-password' : 'current-password'"
              :minlength="mode === 'create' ? 8 : undefined"
              required
            />
          </label>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <p v-if="info" class="info">{{ info }}</p>
          <button class="primary-button" type="submit" :disabled="busy">
            {{
              mode === 'create'
                ? 'Create password'
                : mode === 'reset'
                  ? 'Send reset link'
                  : 'Sign in'
            }}
          </button>
          <div class="links">
            <template v-if="mode === 'signIn'">
              <button class="text-button" type="button" @click="setMode('reset')">
                Forgot password?
              </button>
              <button class="text-button" type="button" @click="setMode('create')">
                First time? Create a password
              </button>
            </template>
            <button v-else class="text-button" type="button" @click="setMode('signIn')">
              Back to sign in
            </button>
          </div>
        </form>
        <p v-else-if="error" class="error" role="alert">{{ error }}</p>

        <p v-if="usingEmulators" class="note">
          Emulators: <code>npm run seed:demo</code> lists the sample accounts.
        </p>
      </template>
    </section>
  </main>
</template>

<style scoped>
.sign-in {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px 16px;
  background: #f6f8fa;
}
.card {
  display: grid;
  gap: 12px;
  width: min(380px, 100%);
  padding: 28px 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 18px rgba(32, 45, 61, 0.06);
}
h1 {
  margin: 0 0 6px;
  font-size: 22px;
}
h2 {
  margin: 0;
  font-size: 17px;
}
p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}
.muted {
  color: var(--muted);
}
.hint {
  font-size: 13px;
}
.note {
  color: var(--muted);
  font-size: 12px;
}
.error {
  color: var(--red);
  font-size: 13px;
}
.info {
  color: var(--green);
  font-size: 13px;
}
.google-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 40px;
  border: 1px solid #dadce0;
  border-radius: 7px;
  background: #fff;
  color: #3c4043;
  font-size: 14px;
  font-weight: 600;
}
.google-button:hover {
  background: #f8f9fa;
}
.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 12px;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--line);
}
.password {
  display: grid;
  gap: 10px;
}
label {
  display: grid;
  gap: 4px;
  color: #3c4650;
  font-size: 13px;
  font-weight: 600;
}
input {
  height: 38px;
  padding: 0 10px;
  border: 1px solid #cfd5db;
  border-radius: 7px;
  font-size: 14px;
  font-weight: 400;
}
input:focus {
  border-color: var(--blue);
  outline: 2px solid var(--blue-soft);
}
.password .primary-button,
.actions .primary-button {
  min-height: 38px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.links {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}
.card > .text-button,
.card > .quiet-button {
  justify-self: start;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
}
</style>
