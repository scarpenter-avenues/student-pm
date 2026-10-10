// Needs the emulators with the demo data: `npm start`, then `npm run seed:demo`.
import { test, expect, type Page } from '@playwright/test'

/** Coaches and mentors see unread huddles in a pop-up once the page's data loads; close it if it shows. */
async function dismissHuddles(page: Page) {
  const popup = page.getByRole('dialog', { name: /huddle/i })
  await popup.waitFor({ timeout: 3000 }).catch(() => {})
  if (await popup.isVisible()) await popup.getByRole('button', { name: 'Later' }).click()
}

test('signed-out visitors land on the sign-in page', async ({ page }) => {
  await page.goto('/t/gear-grinders/list')
  await expect(page).toHaveURL(/\/sign-in\?next=\/t\/gear-grinders\/list/)
  await expect(page.getByRole('heading', { name: 'Example Robotics' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
})

test('a school email is sent to Google sign-in', async ({ page }) => {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill('avery.k@example.edu')
  await page.getByLabel('Password').fill('whatever-1')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('example.edu accounts sign in with Google.')
})

test('an outside mentor signs in with a password, sees only their team, and signs out', async ({
  page,
}) => {
  await page.goto('/t/gear-grinders/list')
  await page.getByLabel('Email').fill('okafor.volunteer@gmail.com')
  await page.getByLabel('Password').fill('switchback-demo')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  // Anchored: the sign-in page's own URL ends with ?next=/t/gear-grinders/list.
  await expect(page).toHaveURL(/^[^?]*\/t\/gear-grinders\/list$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gear Grinders')
  await dismissHuddles(page)

  await page.goto('/dashboard/tasks')
  await expect(page).toHaveURL(/^[^?]*\/t\/gear-grinders\/board$/)
  await dismissHuddles(page)

  await page.getByRole('button', { name: 'Profile' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
})
