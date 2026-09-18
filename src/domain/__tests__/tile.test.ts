import { describe, expect, it } from 'vitest'
import { normalizeTile, projectTile } from '../tile'

describe('tile model', () => {
  it('normalizes dimensions into long and short sides', () => {
    expect(normalizeTile('a', 61, 30)).toEqual({
      id: 'a',
      inputWidthMm: 61,
      inputHeightMm: 30,
      longMm: 61,
      shortMm: 30,
    })
    expect(normalizeTile('b', 31, 60).longMm).toBe(60)
    expect(normalizeTile('b', 31, 60).shortMm).toBe(31)
  })

  it('projects either side orientation onto wall and depth', () => {
    const tile = normalizeTile('a', 61, 30)
    expect(projectTile(tile, 'long-side-along-wall')).toEqual({ alongWallMm: 61, depthMm: 30 })
    expect(projectTile(tile, 'short-side-along-wall')).toEqual({ alongWallMm: 30, depthMm: 61 })
  })

  it('rejects non-finite and non-positive dimensions', () => {
    expect(() => normalizeTile('bad', 0, 30)).toThrow()
    expect(() => normalizeTile('bad', 31, -1)).toThrow()
    expect(() => normalizeTile('bad', Number.NaN, 30)).toThrow()
    expect(() => normalizeTile('bad', Number.POSITIVE_INFINITY, 30)).toThrow()
  })

  it('rejects an invalid runtime orientation', () => {
    const tile = normalizeTile('a', 61, 30)
    expect(() => projectTile(tile, 'diagonal' as never)).toThrow()
  })
})
