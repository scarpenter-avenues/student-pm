// Tests for the GitHub sync's decisions: what a new issue becomes, how closing and reopening follow through, and
// that edits made in the app aren't overwritten.
import { describe, expect, it } from 'vitest'
import { descriptionFrom, hashOf, planIssue, taskIdFor, type Issue, type SyncedTask } from '../sync'

const on = { repo: 'example-robotics/test-team', importIssues: true, closeOnDone: true }
const context = { repo: on.repo, rank: () => 'a5', now: new Date('2026-10-11T12:00:00Z') }
const issue = (over: Partial<Issue> = {}): Issue => ({
  number: 3,
  title: 'Lift requirements',
  body: 'Carry 2 samples.\n\nReach the high basket.',
  state: 'open',
  html_url: 'https://github.com/example-robotics/test-team/issues/3',
  ...over,
})
/** The task the sync would have made for an issue. */
function taskFor(source: Issue, over: Partial<SyncedTask> = {}): SyncedTask {
  const plan = planIssue(source, null, on, context)
  if (plan.action !== 'create') throw new Error('expected a new task')
  return { ...(plan.fields as unknown as SyncedTask), ...over }
}

describe('a new issue', () => {
  it('becomes a GitHub issue task at the bottom of the Backlog, with its description as plain text', () => {
    const plan = planIssue(issue(), null, on, context)
    expect(plan).toMatchObject({
      action: 'create',
      fields: {
        title: 'Lift requirements',
        type: 'GitHub issue',
        status: 'To do',
        sprintId: null,
        rank: 'a5',
        descriptionHtml: '<p>Carry 2 samples.</p><p>Reach the high basket.</p>',
        github: { repo: on.repo, number: 3, state: 'open', url: issue().html_url },
        assigneeIds: [],
      },
    })
  })
  it("isn't added when adding issues is off, when it's already closed, or when it's a pull request", () => {
    expect(planIssue(issue(), null, { ...on, importIssues: false }, context).action).toBe('skip')
    expect(planIssue(issue({ state: 'closed' }), null, on, context).action).toBe('skip')
    expect(planIssue(issue({ pull_request: {} }), null, on, context).action).toBe('skip')
  })
  it("cuts a long title to the app's 90-character limit, so the task can still be edited", () => {
    const long = issue({ title: 'x'.repeat(140) })
    const plan = planIssue(long, null, on, context)
    expect(plan.action === 'create' && (plan.fields.title as string).length).toBe(90)
    // And the cut title isn't mistaken for an edit made in the app.
    expect(planIssue(long, taskFor(long), on, context).action).toBe('skip')
  })
  it('never carries HTML from the issue into the description', () => {
    expect(descriptionFrom('<script>alert(1)</script>\nline two')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;<br>line two</p>',
    )
    expect(descriptionFrom(null)).toBe('')
  })
})

describe('an issue that already has a task', () => {
  it('changes nothing when nothing changed', () => {
    expect(planIssue(issue(), taskFor(issue()), on, context)).toEqual({
      action: 'skip',
      why: 'no change',
    })
  })
  it('closing it marks the task Done; reopening it moves a Done task back to To do', () => {
    const closed = planIssue(issue({ state: 'closed' }), taskFor(issue()), on, context)
    expect(closed).toMatchObject({ action: 'update', fields: { status: 'Done' } })
    // A task whose issue was closed earlier (closed issues aren't added, so build it from an open one).
    const open = taskFor(issue())
    const done: SyncedTask = {
      ...open,
      status: 'Done',
      github: { ...open.github!, state: 'closed' },
    }
    expect(planIssue(issue(), done, on, context)).toMatchObject({
      action: 'update',
      fields: { status: 'To do', github: { state: 'open' } },
    })
  })
  it('leaves the status alone when that option is off, but still records the new state', () => {
    const plan = planIssue(
      issue({ state: 'closed' }),
      taskFor(issue()),
      { ...on, closeOnDone: false },
      context,
    )
    expect(plan.action).toBe('update')
    expect(plan.action === 'update' && plan.fields.status).toBeUndefined()
    expect(plan).toMatchObject({ fields: { github: { state: 'closed' } } })
  })
  it('a new title or description on GitHub follows through', () => {
    const plan = planIssue(
      issue({ title: 'Lift requirements v2', body: 'Carry 3.' }),
      taskFor(issue()),
      on,
      context,
    )
    expect(plan).toMatchObject({
      action: 'update',
      fields: { title: 'Lift requirements v2', descriptionHtml: '<p>Carry 3.</p>' },
    })
  })
  it("doesn't overwrite a title or description someone edited in the app", () => {
    const edited = taskFor(issue(), {
      title: 'Our lift goals',
      descriptionHtml: '<p>Notes from the team</p>',
    })
    const plan = planIssue(
      issue({ title: 'Lift requirements v2', body: 'Carry 3.' }),
      edited,
      on,
      context,
    )
    expect(plan.action).toBe('update')
    if (plan.action !== 'update') return
    expect(plan.fields.title).toBeUndefined()
    expect(plan.fields.descriptionHtml).toBeUndefined()
    // And the next run still sees it as edited, not as "unchanged".
    const next = { ...edited, github: plan.fields.github as SyncedTask['github'] }
    const again = planIssue(
      issue({ title: 'Lift requirements v2', body: 'Carry 4.' }),
      next,
      on,
      context,
    )
    expect(again.action === 'update' && again.fields.descriptionHtml).toBeFalsy()
  })
  it("a task marked Done in the app stays Done while its issue is still open (it's one way)", () => {
    expect(planIssue(issue(), taskFor(issue(), { status: 'Done' }), on, context).action).toBe(
      'skip',
    )
  })
})

describe('ids and fingerprints', () => {
  it('one task id per repo and issue number', () => {
    expect(taskIdFor('Example-Robotics/Test.Team', 12)).toBe('gh-example-robotics-test-team-12')
  })
  it('the same text has the same fingerprint', () => {
    expect(hashOf('<p>a</p>')).toBe(hashOf('<p>a</p>'))
    expect(hashOf('<p>a</p>')).not.toBe(hashOf('<p>b</p>'))
  })
})
