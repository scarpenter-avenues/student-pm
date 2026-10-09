// Needs the emulators with the demo data: `npm start`, then `npm run seed:demo`.
import { test, expect } from '@playwright/test'

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
  await expect(page).toHaveURL(/\/t\/gear-grinders\/list$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gear Grinders')

  await page.goto('/dashboard/tasks')
  await expect(page).toHaveURL(/\/t\/gear-grinders\/board$/)

  await page.getByRole('button', { name: 'Profile' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
})
