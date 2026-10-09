// Subteam tag colors (from the mock-up). Teams use src/ui/teamColor.ts.
import type { SubteamColor } from '@/model/types'

export const SUBTEAM_PALETTE: Record<SubteamColor, { bg: string; fg: string }> = {
  red: { bg: '#ffebe5', fg: '#bb4c31' },
  green: { bg: '#e6f5eb', fg: '#21834f' },
  yellow: { bg: '#fff4d8', fg: '#946a08' },
  blue: { bg: '#edf3ff', fg: '#356fd1' },
  purple: { bg: '#f1ecfb', fg: '#6b4bb8' },
  teal: { bg: '#e4f3f5', fg: '#23717d' },
  pink: { bg: '#fde8f1', fg: '#a83a6e' },
  gray: { bg: '#eef0f2', fg: '#58636c' },
}
