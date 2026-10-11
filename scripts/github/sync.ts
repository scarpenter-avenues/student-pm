// GitHub sync: a team's GitHub issues become "GitHub issue" tasks, one way (GitHub → Switchback). A new open
// issue lands at the bottom of the team's Backlog; closing it marks the task Done and reopening it moves the task
// back to To do; a changed title or description follows GitHub unless someone edited it in the app. It copies the
// title, number, link, open/closed, and the description as plain text. Never authors, assignees, labels, or
// comments, so no GitHub profiles reach the database.
//
// It runs from the same Apps Script as email (scripts/email/appsScript.ts; see docs/github.md), every few minutes,
// as the project's owner. Everything here is synchronous, like Apps Script's network calls.
import { generateKeyBetween } from 'fractional-indexing'
import { escapeHtml } from '../email/text'
import type { Plain, Store } from '../email/rest'

/** What we use of an issue from GitHub's REST API. */
export interface Issue {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  html_url: string
  /** Present on pull requests, which GitHub lists with issues; they're skipped. */
  pull_request?: unknown
}
export interface GithubSettings {
  repo: string | null
  importIssues: boolean
  closeOnDone: boolean
  /** The subteams a new issue's task starts in. */
  subteamIds?: string[]
}
/** The part of a task doc the sync reads. */
export interface SyncedTask {
  title: string
  status: string
  descriptionHtml: string
  github: {
    repo: string
    number: number
    url: string
    state: 'open' | 'closed'
    /** The issue's title and description as last synced, to tell a change on GitHub from an edit in the app. */
    title?: string
    descriptionHash?: string
  } | null
}
export interface GithubIo {
  /** GET a GitHub API path, e.g. "/repos/owner/repo/issues?state=open". */
  github(path: string): { status: number; json: unknown }
  /** Where the last run got to for a team's repo (an ISO time), kept outside the database. */
  cursor(key: string): string | null
  setCursor(key: string, iso: string): void
  now(): Date
  log(message: string): void
}

const MAX_DESCRIPTION = 5000
/** The app's own limit on a task title (firestore.rules). A longer issue title is cut to fit, or the task couldn't be edited in the app afterward. */
const MAX_TITLE = 90

/** An issue's Markdown body as the task's description: plain text, one paragraph per blank-line block. */
export function descriptionFrom(body: string | null): string {
  const text = (body ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_DESCRIPTION)
  if (!text) return ''
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** A short fingerprint of a description (not for security): tells whether it's still what the sync wrote. */
export function hashOf(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

/** The task doc id for an issue: one per repo and number, so a run never creates a second task for it. */
export function taskIdFor(repo: string, number: number): string {
  return `gh-${repo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${number}`
}

export type Plan =
  | { action: 'skip'; why: string }
  | { action: 'create'; fields: Record<string, Plain> }
  | { action: 'update'; fields: Record<string, Plain> }

/** What to do about one issue, given the task it already has (or null) and the team's GitHub settings. */
export function planIssue(
  issue: Issue,
  task: SyncedTask | null,
  settings: GithubSettings,
  context: { repo: string; rank: () => string; now: Date; subteamIds?: readonly string[] },
): Plan {
  if (issue.pull_request) return { action: 'skip', why: 'pull request' }
  const descriptionHtml = descriptionFrom(issue.body)
  const title = issue.title.trim().slice(0, MAX_TITLE) || `Issue #${issue.number}`
  const github = {
    repo: context.repo,
    number: issue.number,
    url: issue.html_url,
    state: issue.state,
    title,
    descriptionHash: hashOf(descriptionHtml),
  }

  if (!task) {
    if (!settings.importIssues) return { action: 'skip', why: 'adding new issues is off' }
    // An issue that was already closed when it's first seen isn't work to plan.
    if (issue.state === 'closed') return { action: 'skip', why: 'already closed' }
    return {
      action: 'create',
      fields: {
        title,
        type: 'GitHub issue',
        status: 'To do',
        sprintId: null,
        rank: context.rank(),
        subteamIds: [...(context.subteamIds ?? [])],
        assigneeIds: [],
        start: null,
        due: null,
        descriptionHtml,
        subtasks: [],
        goalId: null,
        github,
        archived: null,
        createdBy: 'github',
        createdAt: context.now,
        updatedAt: context.now,
      },
    }
  }

  const was = task.github
  const fields: Record<string, Plain> = {}
  // The title and description follow GitHub, unless someone changed them in the app since the last sync.
  if (title !== (was?.title ?? task.title) && task.title === (was?.title ?? task.title))
    fields.title = title
  const untouched = !was?.descriptionHash || hashOf(task.descriptionHtml) === was.descriptionHash
  if (github.descriptionHash !== was?.descriptionHash && untouched)
    fields.descriptionHtml = descriptionHtml
  if (settings.closeOnDone && issue.state !== was?.state) {
    if (issue.state === 'closed' && task.status !== 'Done') fields.status = 'Done'
    if (issue.state === 'open' && task.status === 'Done') fields.status = 'To do'
  }
  const sameRef =
    was &&
    was.state === github.state &&
    was.title === github.title &&
    was.url === github.url &&
    // An edited description keeps its old fingerprint, so the edit isn't mistaken for "unchanged" later.
    (was.descriptionHash === github.descriptionHash || !untouched)
  if (!Object.keys(fields).length && sameRef) return { action: 'skip', why: 'no change' }
  return {
    action: 'update',
    fields: {
      ...fields,
      github: untouched ? github : { ...github, descriptionHash: was?.descriptionHash ?? '' },
      updatedAt: context.now,
    },
  }
}

export interface SyncResult {
  team: string
  repo: string
  created: number
  updated: number
  note?: string
}

/** One run: every team with a connected repo. A team's failure (a bad repo name, no access) doesn't stop the rest. */
export function syncGithub(store: Store, io: GithubIo): SyncResult[] {
  const results: SyncResult[] = []
  for (const team of store.list('teams')) {
    const settings = team.data.github as GithubSettings | undefined
    const repo = settings?.repo
    if (!settings || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) continue
    const result: SyncResult = { team: team.id, repo, created: 0, updated: 0 }
    results.push(result)
    try {
      const started = io.now()
      const key = `${team.id}:${repo}`
      const since = io.cursor(key)
      // The first run for a repo takes its open issues; later runs take whatever changed since the last one.
      const issues: Issue[] = []
      for (let page = 1; page <= 5; page++) {
        const query = since ? `state=all&since=${encodeURIComponent(since)}` : 'state=open'
        const response = io.github(
          `/repos/${repo}/issues?${query}&sort=updated&direction=asc&per_page=100&page=${page}`,
        )
        if (response.status !== 200)
          throw new Error(
            response.status === 404
              ? `GitHub can't find ${repo} (check the name, and that the token can read it).`
              : `GitHub answered ${response.status} for ${repo}.`,
          )
        const batch = response.json as Issue[]
        issues.push(...batch)
        if (batch.length < 100) break
      }

      // The team's choice of subteams for new issues, minus any that have since been deleted.
      const teamSubteams = ((team.data.subteams as { id: string }[] | undefined) ?? []).map(
        (subteam) => subteam.id,
      )
      const subteamIds = (settings.subteamIds ?? []).filter((id) => teamSubteams.includes(id))
      let last: string | null | undefined
      // The rank for the next new task: after the team's last task, then after each one added in this run.
      // Looked up only if something is actually added.
      const rank = () => {
        if (last === undefined) last = store.lastRank(team.id)
        last = generateKeyBetween(last, null)
        return last
      }
      for (const issue of issues) {
        const path = `teams/${team.id}/tasks/${taskIdFor(repo, issue.number)}`
        const existing = store.get(path)
        const plan = planIssue(issue, (existing?.data as unknown as SyncedTask) ?? null, settings, {
          repo,
          rank,
          now: started,
          subteamIds,
        })
        if (plan.action === 'create' && store.create(path, plan.fields)) result.created++
        else if (plan.action === 'update' && existing) {
          store.patch(existing, plan.fields)
          result.updated++
        }
      }
      // A minute of overlap, so an issue changed during this run isn't missed (re-reading one changes nothing).
      io.setCursor(key, new Date(started.getTime() - 60_000).toISOString())
      if (result.created || result.updated)
        io.log(`${repo}: ${result.created} added, ${result.updated} updated`)
    } catch (error) {
      result.note = error instanceof Error ? error.message : String(error)
      io.log(`${repo}: ${result.note}`)
    }
  }
  return results
}
