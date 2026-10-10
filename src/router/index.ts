import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useSession } from '@/stores/session'
import { decide } from './access'
import { DASHBOARD_TABS, DEFAULT_TEAM_TAB, TEAM_TABS } from './tabs'

const tabPattern = (tabs: readonly { id: string }[]) => tabs.map((tab) => tab.id).join('|')

// "/" always redirects (see access.ts), so it never renders anything.
const Empty = { render: () => null }

export const routes: RouteRecordRaw[] = [
  {
    path: '/sign-in',
    name: 'sign-in',
    component: () => import('@/views/SignInView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/components/AppShell.vue'),
    children: [
      // Redirected by the guard to the person's home page.
      { path: '', name: 'home', component: Empty },
      { path: 'no-team', name: 'no-team', component: () => import('@/views/NoTeamView.vue') },
      {
        path: 'huddle',
        name: 'huddle',
        component: () => import('@/views/HuddleView.vue'),
        meta: { adultOnly: true },
      },
      { path: 't/:teamId', redirect: (to) => `${to.path}/${DEFAULT_TEAM_TAB}` },
      {
        path: 't/:teamId/announcements',
        name: 'team-announcements',
        component: () => import('@/views/AnnouncementsView.vue'),
      },
      {
        path: `t/:teamId/:tab(${tabPattern(TEAM_TABS)})`,
        name: 'team',
        component: () => import('@/views/team/TeamView.vue'),
      },
      { path: 'dashboard', redirect: '/dashboard/huddle' },
      {
        path: `dashboard/:tab(${tabPattern(DASHBOARD_TABS)})`,
        name: 'dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: { coachOnly: true },
      },
    ],
  },
  // Dev only: the shared components with sample data (not in production builds).
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/components',
          component: () => import('@/views/dev/ComponentsView.vue'),
          meta: { dev: true },
        },
      ]
    : []),
  { path: '/:unknown(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes })

router.beforeEach(async (to) => {
  const session = useSession()
  void session.start()
  await session.settled()
  return decide(to, { phase: session.phase, member: session.member })
})

export default router
