// Team colors (ported from the mock-up's teamColorOf / applyTeamAccent). A team's color is a preset key (green, teal, …)
// or a custom "#rrggbb" from the color picker.

export interface BadgeColors {
  bg: string
  fg: string
}

export const TEAM_COLORS: Record<string, BadgeColors> = {
  green: { bg: '#74d69b', fg: '#174936' },
  teal: { bg: '#7fd0d6', fg: '#0f4b50' },
  blue: { bg: '#8fb5f5', fg: '#173a73' },
  navy: { bg: '#27406b', fg: '#ffffff' },
  purple: { bg: '#b9a3f0', fg: '#3a2675' },
  pink: { bg: '#f2a5c8', fg: '#6b1840' },
  red: { bg: '#f29a8a', fg: '#6b1e12' },
  orange: { bg: '#f5b971', fg: '#6b3b06' },
  yellow: { bg: '#f2d36b', fg: '#5c4705' },
  gray: { bg: '#b8c0c7', fg: '#2e363d' },
}

const isHex = (color: string) => /^#[0-9a-f]{6}$/i.test(color)

function channels(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
}

function luminance(hex: string): number {
  const [red = 0, green = 0, blue = 0] = channels(hex).map((value) => value / 255)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** Mixes `hex` toward `target` by `amount` (0–1). */
export function mixHex(hex: string, target: string, amount: number): string {
  const to = channels(target)
  const mixed = channels(hex).map((value, i) => Math.round(value + ((to[i] ?? 0) - value) * amount))
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

/** Badge colors. Custom colors get white text when dark and a deep shade of the color when light. */
export function teamColorOf(color: string | undefined): BadgeColors {
  const preset = color ? TEAM_COLORS[color] : undefined
  if (preset) return preset
  if (color && isHex(color)) {
    return { bg: color, fg: luminance(color) < 0.5 ? '#ffffff' : mixHex(color, '#000000', 0.7) }
  }
  return TEAM_COLORS.green!
}

/** The team-tinted CSS variables that replace light blues across the app. */
export function teamAccent(color: string | undefined): Record<string, string> {
  const base = teamColorOf(color).bg
  return {
    '--team-soft': mixHex(base, '#ffffff', 0.8),
    '--team-softer': mixHex(base, '#ffffff', 0.9),
    '--team-line': mixHex(base, '#ffffff', 0.5),
    '--team-wash': mixHex(base, '#ffffff', 0.86),
    // Text on the tints must stay readable: dark team colors are used as-is, light ones are darkened.
    '--team-ink': luminance(base) < 0.35 ? base : mixHex(base, '#000000', 0.55),
  }
}
