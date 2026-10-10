// @ mentions in rich text (huddles): students, coaches and mentors, and teams. A mention is stored in the HTML as
// <span data-type="mention" data-id data-label data-kind data-team data-color>, shown as a chip without the "@":
// teams in their own color, students in a tint of their team's, coaches and mentors in gray. Every editor and every
// read-only view has the node, so saved mentions always show; only editors given a search can insert them.
import { mergeAttributes } from '@tiptap/vue-3'
import Mention from '@tiptap/extension-mention'
import { useSession } from '@/stores/session'
import { teamAccent, teamColorOf } from './teamColor'

export type MentionKind = 'student' | 'adult' | 'team'
export interface MentionItem {
  /** "member:<uid>" or "team:<teamId>" */
  id: string
  label: string
  kind: MentionKind
  /** A team, or a student's team. */
  teamId: string | null
  /** The team's color when the mention was made (used if the team isn't loaded where it's shown). */
  color: string | null
  /** Shown in the search list only, e.g. the student's team or "Mentor". */
  detail: string
}
export type MentionSearch = (query: string) => MentionItem[]

/** Chip colors. Team colors go through teamColorOf, which accepts only presets and #rrggbb, so stored HTML can't
 * inject CSS. The team's current color wins over the one stored with the mention. */
function mentionStyle(kind: string, teamId: string | null, stored: string | null): string {
  if (kind !== 'team' && kind !== 'student') return ''
  let color = stored ?? undefined
  try {
    color = (teamId && useSession().teamsById[teamId]?.color) || color
  } catch {
    // No store (e.g. the dev gallery before sign-in): use the stored color.
  }
  if (kind === 'team') {
    const { bg, fg } = teamColorOf(color)
    return `background:${bg};color:${fg}`
  }
  const accent = teamAccent(color)
  return `background:${accent['--team-soft']};color:${accent['--team-ink']}`
}

const dataAttribute = (name: string, attribute: string) => ({
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute(attribute),
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes[name] ? { [attribute]: attributes[name] } : {},
})

export const MentionNode = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      kind: dataAttribute('kind', 'data-kind'),
      teamId: dataAttribute('teamId', 'data-team'),
      color: dataAttribute('color', 'data-color'),
    }
  },
  renderHTML({ node, HTMLAttributes }) {
    const kind = ['student', 'adult', 'team'].includes(node.attrs.kind) ? node.attrs.kind : 'adult'
    return [
      'span',
      mergeAttributes({ 'data-type': this.name }, HTMLAttributes, {
        class: `mention mention-${kind}`,
        style: mentionStyle(kind, node.attrs.teamId, node.attrs.color),
      }),
      node.attrs.label ?? '',
    ]
  },
  renderText({ node }) {
    return node.attrs.label ?? ''
  },
})

/** The search for a program's people and teams: names that start with the query first, then other matches. */
export function mentionSearch(
  sources: () => {
    students: readonly { id: string; displayName: string; teamId: string | null }[]
    adults: readonly { id: string; displayName: string; role: string }[]
    teams: readonly { id: string; name: string; color: string }[]
  },
): MentionSearch {
  return (query) => {
    const { students, adults, teams } = sources()
    const teamById = new Map(teams.map((team) => [team.id, team]))
    const items: MentionItem[] = [
      ...teams.map((team) => ({
        id: `team:${team.id}`,
        label: team.name,
        kind: 'team' as const,
        teamId: team.id,
        color: team.color,
        detail: 'Team',
      })),
      ...adults.map((adult) => ({
        id: `member:${adult.id}`,
        label: adult.displayName,
        kind: 'adult' as const,
        teamId: null,
        color: null,
        detail: adult.role === 'coach' ? 'Coach' : 'Mentor',
      })),
      ...students.map((student) => {
        const team = student.teamId ? teamById.get(student.teamId) : undefined
        return {
          id: `member:${student.id}`,
          label: student.displayName,
          kind: 'student' as const,
          teamId: team?.id ?? null,
          color: team?.color ?? null,
          detail: team?.name ?? 'No team',
        }
      }),
    ]
    const q = query.trim().toLowerCase()
    const starts = (item: MentionItem) =>
      item.label
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.startsWith(q))
    return items
      .filter((item) => !q || item.label.toLowerCase().includes(q))
      .sort((a, b) => Number(starts(b)) - Number(starts(a)))
      .slice(0, 8)
  }
}
