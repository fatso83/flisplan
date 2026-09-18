import { test, expect } from '@playwright/test'

test('renders the Flisplan heading', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /flisplan/i })).toBeVisible()
})
