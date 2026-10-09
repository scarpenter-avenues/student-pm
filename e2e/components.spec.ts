// The shared components on the dev-only gallery page (/dev/components). Needs only the dev server.
import { test, expect, type Page } from '@playwright/test'

const lastEvent = (page: Page) => page.locator('[data-test=log] li').first()

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/components')
  await expect(page.locator('[data-test=status]')).toBeVisible()
})

test('a choice menu picks one value and closes', async ({ page }) => {
  await page.locator('[data-test=status]').click()
  await page.locator('.choice-menu').getByRole('menuitem', { name: /Done/ }).click()
  await expect(lastEvent(page)).toHaveText('status → Done')
  await expect(page.locator('.choice-menu')).toHaveCount(0)
})

test('a multi-select applies when it closes, and Esc cancels', async ({ page }) => {
  await page.locator('[data-test=subteams]').click()
  await page.getByRole('menuitemcheckbox', { name: /Software/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-test=log] li')).toHaveCount(0)
  await page.locator('[data-test=subteams]').click()
  await page.getByRole('menuitemcheckbox', { name: /Outreach/ }).click()
  await page.getByRole('menuitemcheckbox', { name: /Software/ }).click()
  await page.getByRole('heading', { name: 'Shared components' }).click()
  // Saved in the team's subteam order, not click order.
  await expect(lastEvent(page)).toHaveText('subteams → mechanical, software, outreach')
})

test('dates are picked from the calendar, by mouse or keyboard, and can be cleared', async ({
  page,
}) => {
  await page.locator('[data-test=due]').click()
  const calendar = page.getByRole('dialog', { name: 'Due date' })
  await expect(calendar.locator('[data-day="2026-10-04"]')).toBeDisabled()
  await expect(calendar.locator('.day.in-range')).toHaveCount(16)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(lastEvent(page)).toHaveText('due → 2026-10-22')
  await expect(page.locator('[data-test=due]')).toHaveText('Oct 22')
  await page.locator('[data-test=due]').click()
  await page.getByRole('button', { name: 'Clear date' }).click()
  await expect(page.locator('[data-test=due]')).toHaveText('Due date')
})

test('assignees: type to filter, Enter adds, Backspace removes', async ({ page }) => {
  await page.locator('.assignee-picker').click()
  await page.keyboard.type('jo')
  await expect(page.getByRole('option', { name: /Jordan M\./ })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(lastEvent(page)).toHaveText('assignees → avery-k, jordan-m')
  await page.keyboard.press('Backspace')
  await expect(lastEvent(page)).toHaveText('assignees → avery-k')
})

test('titles rename in place: Enter saves, Esc cancels', async ({ page }) => {
  const title = page.locator('[data-test=title]')
  await title.locator('.title-button').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Something else')
  await page.keyboard.press('Escape')
  await expect(title.locator('.title-button')).toHaveText('Prototype claw fingers')
  await title.locator('.title-button').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('  Prototype   claw v2 ')
  await page.keyboard.press('Enter')
  await expect(lastEvent(page)).toHaveText('title → Prototype claw v2')
})

test('team pickers: one team closes on pick; several apply on close', async ({ page }) => {
  await page.locator('[data-test=student-team]').click()
  await page.locator('.check-menu label', { hasText: 'Gear Grinders' }).click()
  await expect(page.locator('[data-test=student-team]')).toHaveText('Gear Grinders')
  await page.locator('[data-test=mentor-teams]').click()
  await page.locator('.check-menu label', { hasText: 'All teams' }).click()
  await expect(lastEvent(page)).toHaveText('student team → gear-grinders')
  await page.getByRole('heading', { name: 'Shared components' }).click()
  await expect(page.locator('[data-test=mentor-teams]')).toHaveText('All teams')
})

test('rich text: the bubble formats a selection', async ({ page }) => {
  await page
    .locator('.rich-content p')
    .first()
    .dblclick({ position: { x: 20, y: 8 } })
  await page.getByRole('button', { name: 'Italic' }).click()
  await expect(page.locator('.html')).toContainText('<em>Build</em>')
})
