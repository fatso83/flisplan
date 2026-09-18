import { expect, test } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name)

test('imports, optimizes, swaps, saves, and reloads a named 50-tile plan', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('CSV-fil').setInputFiles(fixture('tiles-50.csv'))
  await expect(page.getByRole('status')).toHaveText('50 fliser · 25 par')

  await page.getByRole('radio', { name: 'Kortside langs vegg' }).check()
  await page.getByRole('button', { name: 'Optimaliser' }).click()
  await expect(page.getByRole('heading', { name: 'Plan' })).toBeVisible()
  const first = page.getByRole('button', { name: /Anne-01,/ })
  await expect(first).toContainText('100 × 300 mm')
  await page.getByRole('radio', { name: 'Langside langs vegg' }).check()
  await expect(first).toContainText('300 × 100 mm')
  await expect(page.getByRole('button', { name: /Anne-\d+, (øvre|nedre) rad, posisjon \d+/ })).toHaveCount(50)
  await expect(page.getByText('Par').locator('..').getByText('25')).toBeVisible()
  await page.getByLabel('Fuge (mm)').fill('3.5')
  await page.getByLabel('Toleranse (mm)').fill('4.5')
  await expect(page.getByLabel('Fuge (mm)')).toHaveValue('3.5')
  await expect(page.getByLabel('Toleranse (mm)')).toHaveValue('4.5')

  const dragSource = page.getByRole('button', { name: /Anne-03,/ })
  const dragTarget = page.getByRole('button', { name: /Anne-04,/ })
  const dragSourceBefore = await dragSource.getAttribute('aria-label')
  const dragTargetBefore = await dragTarget.getAttribute('aria-label')
  await dragSource.dragTo(dragTarget)
  await expect(page.getByText(/Byttet Anne-03 med Anne-04/)).toBeVisible()
  await expect(dragSource).not.toHaveAttribute('aria-label', dragSourceBefore!)
  await expect(dragTarget).not.toHaveAttribute('aria-label', dragTargetBefore!)

  const second = page.getByRole('button', { name: /Anne-02,/ })
  const firstBefore = await first.getAttribute('aria-label')
  const secondBefore = await second.getAttribute('aria-label')
  expect(firstBefore).not.toBe(secondBefore)
  await first.press('Enter')
  const secondRow = secondBefore?.includes('øvre') ? 'upper' : 'lower'
  const secondPosition = Number(secondBefore?.match(/posisjon (\d+)/)?.[1]) - 1
  await page.getByLabel('Bytt med').selectOption(`${secondRow}:${secondPosition}`)
  await page.getByRole('button', { name: 'Bytt fliser' }).press('Enter')
  await expect(page.getByText(/Byttet Anne-01 med Anne-02/)).toBeVisible()
  await expect(first).not.toHaveAttribute('aria-label', firstBefore!)
  await expect(second).not.toHaveAttribute('aria-label', secondBefore!)

  const name = 'Prosjekt Anne – variant 1'
  await page.getByLabel('Prosjektnavn').fill(name)
  await page.getByRole('button', { name: 'Lagre prosjekt' }).click()
  await expect(page.getByRole('alert')).toHaveText(`Prosjektet «${name}» er lagret.`)

  const firstAfterSave = await first.getAttribute('aria-label')
  const secondAfterSave = await second.getAttribute('aria-label')
  const dragSourceAfterSave = await dragSource.getAttribute('aria-label')
  const dragTargetAfterSave = await dragTarget.getAttribute('aria-label')
  await page.reload()
  await expect(page.getByLabel('Last prosjekt')).toBeVisible()
  await page.getByLabel('Last prosjekt').selectOption({ label: name })
  await expect(page.getByRole('alert')).toHaveText(`Lastet «${name}».`)
  await expect(page.getByRole('radio', { name: 'Langside langs vegg' })).toBeChecked()
  await expect(page.getByLabel('Fuge (mm)')).toHaveValue('3.5')
  await expect(page.getByLabel('Toleranse (mm)')).toHaveValue('4.5')
  await expect(page.getByRole('button', { name: /Anne-01,/ })).toHaveAttribute('aria-label', firstAfterSave!)
  await expect(page.getByRole('button', { name: /Anne-02,/ })).toHaveAttribute('aria-label', secondAfterSave!)
  await expect(page.getByRole('button', { name: /Anne-03,/ })).toHaveAttribute('aria-label', dragSourceAfterSave!)
  await expect(page.getByRole('button', { name: /Anne-04,/ })).toHaveAttribute('aria-label', dragTargetAfterSave!)
})

test('shows a visible error and disables optimization for odd or malformed imports', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('CSV-fil').setInputFiles(fixture('tiles-odd.csv'))
  await expect(page.getByRole('alert')).toContainText('Tile count must be even')
  await expect(page.getByRole('button', { name: 'Optimaliser' })).toBeDisabled()

  await page.getByLabel('CSV-fil').setInputFiles({
    name: 'malformed.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('id,bredde_mm,hoyde_mm\nBad-01,not-a-number,100\nBad-02,300,100\n'),
  })
  await expect(page.getByRole('alert')).toContainText('Dimensions must be finite and positive')
  await expect(page.getByRole('button', { name: 'Optimaliser' })).toBeDisabled()
})

test('imports semicolon-delimited decimal-comma CSV', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('CSV-fil').setInputFiles({
    name: 'norsk.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('id;bredde_mm;hoyde_mm\nNorsk-01;300,5;100\nNorsk-02;301,5;100\n'),
  })
  await expect(page.getByRole('status')).toHaveText('2 fliser · 1 par')
  await expect(page.getByRole('button', { name: 'Optimaliser' })).toBeEnabled()
})
