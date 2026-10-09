/** "Avery K." → "AK", "Coach Rivera" → "CR". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.match(/\p{L}|\d/u)?.[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase()
}
