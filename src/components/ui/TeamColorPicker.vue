<script setup lang="ts">
// Team color: the preset swatches, then the team's custom color as its own swatch (once there is one), then a rainbow
// button that opens the system color picker. Picking updates the custom swatch live and selects it; choosing a preset
// keeps the custom swatch so you can switch back. Custom colors are "#rrggbb".
import { ref, watch } from 'vue'
import { TEAM_COLOR_PRESETS } from '@/model/types'
import { teamColorOf } from '@/ui/teamColor'

const props = defineProps<{ modelValue: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [color: string] }>()

const isHex = (color: string) => /^#[0-9a-f]{6}$/i.test(color)
const custom = ref(isHex(props.modelValue) ? props.modelValue : '')
watch(
  () => props.modelValue,
  (color) => {
    if (isHex(color)) custom.value = color
  },
)
const input = ref<HTMLInputElement | null>(null)
function pickCustom(event: Event) {
  const color = (event.target as HTMLInputElement).value
  custom.value = color
  emit('update:modelValue', color)
}
</script>

<template>
  <div class="swatches" role="radiogroup" aria-label="Team color">
    <button
      v-for="preset in TEAM_COLOR_PRESETS"
      :key="preset"
      type="button"
      class="swatch"
      role="radio"
      :aria-checked="modelValue === preset"
      :aria-label="preset"
      :disabled="disabled"
      :style="{ background: teamColorOf(preset).bg }"
      @click="emit('update:modelValue', preset)"
    />
    <button
      v-if="custom"
      type="button"
      class="swatch"
      role="radio"
      :aria-checked="modelValue === custom"
      :aria-label="`Custom color ${custom}`"
      :disabled="disabled"
      :style="{ background: custom }"
      @click="emit('update:modelValue', custom)"
    />
    <button
      type="button"
      class="swatch rainbow"
      aria-label="Pick a custom color"
      :disabled="disabled"
      @click="input?.click()"
    />
    <input
      ref="input"
      class="native"
      type="color"
      tabindex="-1"
      aria-hidden="true"
      :value="custom || '#74d69b'"
      @input="pickCustom"
    />
  </div>
</template>

<style scoped>
.swatches {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.swatch {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 2px solid #fff;
  border-radius: 7px;
  box-shadow: 0 0 0 1px var(--line);
}
.swatch[aria-checked='true'] {
  box-shadow: 0 0 0 2px #2c343b;
}
.swatch:disabled {
  cursor: default;
}
.rainbow {
  background: conic-gradient(
    #f29a8a,
    #f5b971,
    #f2d36b,
    #74d69b,
    #7fd0d6,
    #8fb5f5,
    #b9a3f0,
    #f2a5c8,
    #f29a8a
  );
}
.native {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
