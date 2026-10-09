import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'

// Unit tests don't talk to Firebase.
vi.mock('../firebase', () => ({ usingEmulators: false }))

import App from '../App.vue'

describe('App', () => {
  it('renders the app name', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] })
    const wrapper = mount(App, { global: { plugins: [router] } })
    expect(wrapper.text()).toContain('Switchback')
  })
})
