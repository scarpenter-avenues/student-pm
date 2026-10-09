// The tabs under the top bar. The route's :tab param is the tab id.

export interface Tab {
  id: string
  label: string
  /** The Settings tab sits at the right with a gear icon. */
  gear?: boolean
}

export const TEAM_TABS: readonly Tab[] = [
  { id: 'home', label: 'Team Home' },
  { id: 'planning', label: 'Planning' },
  { id: 'my-tasks', label: 'My Tasks' },
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'goals', label: 'Goals' },
  { id: 'settings', label: 'Settings', gear: true },
]

export const DASHBOARD_TABS: readonly Tab[] = [
  { id: 'huddle', label: 'Huddle' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'goals', label: 'Goals' },
  { id: 'settings', label: 'Settings', gear: true },
]

/** Where a team opens. */
export const DEFAULT_TEAM_TAB = 'board'
