<script setup lang="ts">
// After finishing a goal: offer to set the next one (queued steps, like another goal's check-in, come first).
import { useGoalFlow } from '@/stores/goalFlow'
import { useToast } from '@/stores/toast'
import { MAX_ACTIVE_GOALS } from '@/model/goals'

const props = defineProps<{ activeCount: number }>()
const flow = useGoalFlow()
const toast = useToast()
const queued = flow.hasQueued()
function setNext() {
  if (props.activeCount >= MAX_ACTIVE_GOALS)
    return toast.show(
      `You can work on up to ${MAX_ACTIVE_GOALS} goals at once. Pause or finish one first.`,
    )
  flow.open({ kind: 'wizard' })
}
</script>

<template>
  <p class="goal-kicker">Goal finished</p>
  <h2>Nice work. It's saved in your goal history.</h2>
  <p class="goal-lead">
    {{ activeCount ? 'Want to add another goal now?' : 'Want to set your next goal now?' }} You can
    also do it later from the Goals tab.
  </p>
  <div class="goal-modal-actions">
    <button type="button" class="goal-button" @click="flow.next()">
      {{ queued ? 'Continue' : 'Later' }}
    </button>
    <button type="button" class="goal-button primary" @click="setNext">
      {{ activeCount ? 'Add a goal' : 'Set my next goal' }}
    </button>
  </div>
</template>
