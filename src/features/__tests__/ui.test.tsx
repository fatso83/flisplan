import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { normalizeTile } from '../../domain/tile'
import { optimizeLayout } from '../../domain/layout'
import { CsvImport } from '../import/CsvImport'
import { PlanningBoard } from '../planning/PlanningBoard'

describe('feature UI', () => {
  it('shows imported tile counts', async () => {
    render(<CsvImport onImport={() => undefined} />)
    const input = screen.getByLabelText(/csv-fil/i)
    const file = new File(['id,bredde_mm,hoyde_mm\na,300,600\nb,300,600'], 'tiles.csv', { type: 'text/csv' })
    Object.defineProperty(input, 'files', { value: [file] })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(await screen.findByText(/2 fliser/i)).toBeTruthy()
    expect(screen.getByText(/1 par/i)).toBeTruthy()
  })

  it('clears stale import details when reset token changes', async () => {
    function Harness() { const [token, setToken] = useState(0); return <><button onClick={() => setToken(1)}>Reset</button><CsvImport resetToken={token} onImport={() => undefined} /></> }
    render(<Harness />)
    const input = screen.getByLabelText(/csv-fil/i)
    const file = new File(['id,bredde_mm,hoyde_mm\na,300,600\nb,300,600'], 'tiles.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText(/2 fliser/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.queryByText(/2 fliser/i)).toBeNull()
    expect(screen.queryByText('tiles.csv')).toBeNull()
    expect((screen.getByLabelText(/csv-fil/i) as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByLabelText(/csv-fil/i), { target: { files: [file] } })
    expect(await screen.findByText(/2 fliser/i)).toBeTruthy()
  })

  it('renders two labeled rows and metrics', () => {
    const tiles = [normalizeTile('a', 300, 600), normalizeTile('b', 320, 600)]
    render(<PlanningBoard tiles={tiles} layout={optimizeLayout(tiles, 'long-side-along-wall')} toleranceMm={2} onLayoutChange={() => undefined} />)
    expect(screen.getByText('Øvre rad')).toBeTruthy()
    expect(screen.getByText('Nedre rad')).toBeTruthy()
    expect(screen.getByText(/Flush fuge/i)).toBeTruthy()
    expect(screen.getByText(/maks sømdrift|maks seam drift/i)).toBeTruthy()
    expect(screen.getByText(/Visuell fuge: 2[.,]0 mm/i)).toBeTruthy()
    const board = screen.getByLabelText('Flisplan med to rader')
    expect(board.getAttribute('style')).toContain('--grout-gap: 0.7px')
    const order = Array.from(board.children).map((child) => child.textContent)
    expect(order.findIndex((text) => text?.includes('Øvre rad'))).toBeLessThan(order.findIndex((text) => text?.includes('Flush fuge')))
    expect(order.findIndex((text) => text?.includes('Flush fuge'))).toBeLessThan(order.findIndex((text) => text?.includes('Nedre rad')))
    expect(screen.getByLabelText('Flush fuge').classList.contains('flush-seam')).toBe(true)
  })
})
