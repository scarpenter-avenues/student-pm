/** Alt+↑ / Alt+↓ on a row or card: the step to move it (-1 or 1), or 0 for any other key. */
export function altMove(event: KeyboardEvent): -1 | 0 | 1 {
  if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return 0
  event.preventDefault()
  return event.key === 'ArrowUp' ? -1 : 1
}
