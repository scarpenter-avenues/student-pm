// The goal pop-ups (set a goal, check in, wrap up, pause, date passed, the arrival reminder) open one at a time.
// Steps can be queued (e.g. two due check-ins on arrival): finishing one opens the next; Cancel drops the rest.
// GoalFlowHost (in AppShell) shows the current step.
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export type GoalStep =
  | { kind: 'wizard'; goalId?: string; startAt?: 'by' | 'review'; replaces?: string }
  | { kind: 'checkin'; goalId: string }
  | { kind: 'reflection'; goalId: string }
  | { kind: 'finished' }
  | { kind: 'pause'; goalId: string }
  | { kind: 'datePassed'; goalId: string }
  | { kind: 'prompt' }

export const useGoalFlow = defineStore('goalFlow', () => {
  const current = shallowRef<GoalStep | null>(null)
  let queue: GoalStep[] = []

  return {
    current,
    /** Opens one step (replacing whatever is open, and dropping the queue). */
    open(step: GoalStep) {
      queue = []
      current.value = step
    },
    /** Runs steps in order. */
    run(steps: GoalStep[]) {
      queue = steps.slice(1)
      current.value = steps[0] ?? null
    },
    /** Replaces the open step without touching the queue (e.g. a check-in that turns into a wrap-up). */
    replace(step: GoalStep) {
      current.value = step
    },
    /** This step is done: on to the next queued one. */
    next() {
      current.value = queue.shift() ?? null
    },
    hasQueued: () => queue.length > 0,
    close() {
      queue = []
      current.value = null
    },
  }
})
