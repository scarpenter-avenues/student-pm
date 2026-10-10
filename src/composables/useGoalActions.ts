// What a student does with a goal, as writes: set one, edit it, check in, finish, pause, resume, change it. Steps
// they name become Learning tasks assigned to them, linked to the goal (so check-ins can offer them as evidence).
import { writes } from '@/data'
import { todayIso } from '@/model/dates'
import { MAX_ACTIVE_GOALS, cleanText } from '@/model/goals'
import { rankAt } from '@/model/rank'
import type { Goal, GoalEvent, PlanResult, GoalStatus } from '@/model/types'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import { useTeam } from './useTeamData'
import type { GoalDoc } from './useGoals'

export interface GoalDraft {
  wish: string
  evidence: string
  by: { label: string; date: string | null } | null
  obstacle: string
  plan: string
}

export function useGoalActions() {
  const team = useTeam()
  const session = useSession()
  const toast = useToast()
  const fail = (error: Error) => toast.show(`Couldn't save: ${error.message}`)
  const today = () => todayIso()

  /** A Learning task for me in a sprint, linked to the goal. */
  function addLearningTask(title: string, sprintId: string | null, goalId: string) {
    const teamId = team.teamId.value
    const uid = session.member?.id
    if (!teamId || !uid) return
    const mine = team.subteamsOf(uid)
    const subteamIds = mine.length
      ? [mine[0]!]
      : team.subteams.value[0]
        ? [team.subteams.value[0].id]
        : []
    const ranks = team.tasksIn(sprintId).map((task) => task.rank)
    const { written } = writes.addTask(
      teamId,
      {
        title: cleanText(title).slice(0, 90),
        type: 'Learning',
        assigneeIds: [uid],
        subteamIds,
        sprintId,
        goalId,
      },
      rankAt(ranks, 'bottom'),
    )
    written.catch(fail)
  }

  function create(draft: GoalDraft, firstStep: string | null) {
    const teamId = team.teamId.value
    const seasonId = session.program?.currentSeasonId
    if (!teamId || !seasonId || !draft.by) return null
    const { id, written } = writes.createGoal(
      {
        teamId,
        seasonId,
        wish: cleanText(draft.wish),
        evidence: cleanText(draft.evidence),
        obstacle: cleanText(draft.obstacle),
        plan: cleanText(draft.plan),
        by: draft.by,
      },
      today(),
    )
    written.catch(fail)
    if (firstStep) addLearningTask(firstStep, team.currentSprint.value?.id ?? null, id)
    return id
  }

  function update(
    goal: GoalDoc,
    changes: Partial<Goal>,
    record: Omit<GoalEvent, 'authorId' | 'teamId' | 'date' | 'createdAt'> | null,
  ) {
    return writes.updateGoal(goal, changes, record, today()).catch(fail)
  }

  function edit(goal: GoalDoc, draft: GoalDraft) {
    const next = {
      wish: cleanText(draft.wish),
      evidence: cleanText(draft.evidence),
      obstacle: cleanText(draft.obstacle),
      plan: cleanText(draft.plan),
      by: draft.by ?? goal.by,
    }
    const changes: string[] = []
    if (goal.by.date !== next.by.date || goal.by.label !== next.by.label)
      changes.push(`Moved date: ${goal.by.label} → ${next.by.label}`)
    if ((['wish', 'evidence', 'obstacle', 'plan'] as const).some((key) => next[key] !== goal[key]))
      changes.push('Updated the goal details')
    if (!changes.length) return toast.show('No changes')
    void update(goal, next, { type: 'edit', change: changes.join(' · ') })
    toast.show('Goal updated')
  }

  function checkin(
    goal: GoalDoc,
    answer: {
      status: GoalStatus
      taskIds: string[]
      note: string
      planResult: PlanResult
      newPlan: string | null
      steps: { title: string; sprintId: string }[]
    },
  ) {
    void update(
      goal,
      {
        status: answer.status,
        lastCheckinAt: today(),
        ...(answer.newPlan ? { plan: answer.newPlan } : {}),
      },
      {
        type: 'checkin',
        status: answer.status,
        taskIds: answer.taskIds,
        note: answer.note,
        planResult: answer.planResult,
        ...(answer.newPlan ? { newPlan: answer.newPlan } : {}),
        nextSteps: answer.steps.map((step) => ({ ...step, taskId: '' })),
      },
    )
    answer.steps.forEach((step) => addLearningTask(step.title, step.sprintId, goal.id))
  }

  function finish(goal: GoalDoc, reflection: { helped: string; different: string; next: string }) {
    void update(
      goal,
      { state: 'done', status: 'Got it', reflection, finishedAt: new Date() as never },
      { type: 'completed' },
    )
  }

  function pause(goal: GoalDoc, reason: string | null) {
    void update(
      goal,
      { state: 'paused', pausedAt: new Date() as never },
      { type: 'paused', ...(reason ? { reason } : {}) },
    )
    toast.show('Goal paused. Find it under Paused goals.')
  }

  /** false when there are already 3 active goals. */
  function resume(goal: GoalDoc, activeCount: number): boolean {
    if (activeCount >= MAX_ACTIVE_GOALS) {
      toast.show(
        `You can work on up to ${MAX_ACTIVE_GOALS} goals at once. Pause or finish one first.`,
      )
      return false
    }
    void update(goal, { state: 'active', pausedAt: null }, { type: 'resumed' })
    return true
  }

  /** The old goal moves to history as "Changed" once its replacement is saved. */
  function changeTo(old: GoalDoc, statement: string) {
    void update(
      old,
      { state: 'changed', finishedAt: new Date() as never },
      { type: 'changed', to: statement },
    )
  }

  function markFeedbackRead(goal: GoalDoc) {
    if (goal.unreadFeedback > 0) writes.markFeedbackRead(goal.id).catch(fail)
  }

  return {
    create,
    edit,
    checkin,
    finish,
    pause,
    resume,
    changeTo,
    markFeedbackRead,
    addLearningTask,
  }
}
