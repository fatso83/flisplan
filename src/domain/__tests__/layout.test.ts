import { describe, expect, it } from 'vitest'
import { normalizeTile } from '../tile'
import { optimizeLayout, swapTiles, type SlotAddress } from '../layout'

const tile = (id: string, width: number, height = 10) => normalizeTile(id, width, height)

describe('layout optimizer', () => {
  it('pairs adjacent projected widths and uses every tile exactly once', () => {
    const tiles = Array.from({ length: 50 }, (_, i) => tile(`t${i}`, 100 + ((i * 7) % 31)))
    const layout = optimizeLayout(tiles, 'long-side-along-wall')
    expect(layout.slots).toHaveLength(25)
    expect(layout.slots.flatMap((s) => [s.upperTileId, s.lowerTileId]).sort()).toEqual(tiles.map((t) => t.id).sort())
    expect(new Set([layout.slots[0].upperTileId, layout.slots[0].lowerTileId])).toEqual(new Set(['t0', 't31']))
  })

  it('breaks equal width ties by tile id and supports both orientations', () => {
    const tiles = [tile('b', 40, 20), tile('a', 40, 20), tile('d', 60, 10), tile('c', 60, 10)]
    const long = optimizeLayout(tiles, 'long-side-along-wall')
    const short = optimizeLayout(tiles, 'short-side-along-wall')
    expect(long.slots).toEqual([
      { position: 0, upperTileId: 'a', lowerTileId: 'b' },
      { position: 1, upperTileId: 'c', lowerTileId: 'd' },
    ])
    expect(short.slots).toHaveLength(2)
    expect(short.slots.flatMap((s) => [s.upperTileId, s.lowerTileId]).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('reports mismatch and cumulative seam metrics', () => {
    const layout = optimizeLayout([tile('a', 100), tile('b', 90), tile('c', 80), tile('d', 70)], 'long-side-along-wall')
    expect(layout.metrics.pairWidthMismatchesMm).toEqual([10, 10])
    expect(layout.metrics.totalUpperWidthMm + layout.metrics.totalLowerWidthMm).toBe(340)
    expect(layout.metrics.cumulativeSeamDriftMm.at(-1)).toBe(layout.metrics.totalUpperWidthMm - layout.metrics.totalLowerWidthMm)
    expect(layout.metrics.absoluteFinalDriftMm).toBe(Math.abs(layout.metrics.cumulativeSeamDriftMm.at(-1)!))
  })

  it('balances signs to minimize maximum prefix drift', () => {
    const layout = optimizeLayout([tile('a', 100), tile('b', 90), tile('c', 80), tile('d', 70), tile('e', 60), tile('f', 50)], 'long-side-along-wall')
    expect(layout.metrics.maximumAbsoluteDriftMm).toBe(10)
    expect(layout.metrics.cumulativeSeamDriftMm.map(Math.abs)).toEqual([10, 0, 10])
  })

  it('rejects less than two or odd tile counts', () => {
    expect(() => optimizeLayout([], 'long-side-along-wall')).toThrow(RangeError)
    expect(() => optimizeLayout([tile('a', 10)], 'long-side-along-wall')).toThrow(RangeError)
    expect(() => optimizeLayout([tile('a', 10), tile('b', 10), tile('c', 10)], 'long-side-along-wall')).toThrow(RangeError)
  })

  it('rejects empty and duplicate tile ids', () => {
    expect(() => optimizeLayout([tile('', 10), tile('b', 10)], 'long-side-along-wall')).toThrow(RangeError)
    expect(() => optimizeLayout([tile('   ', 10), tile('b', 10)], 'long-side-along-wall')).toThrow(RangeError)
    expect(() => optimizeLayout([tile('a', 10), tile('a', 11)], 'long-side-along-wall')).toThrow(RangeError)
  })

  it('preserves fractional dimensions and does not mutate source tiles', () => {
    const tiles = [tile('a', 100.25), tile('b', 90.15), tile('c', 80.35), tile('d', 70.25)]
    const snapshot = structuredClone(tiles)
    const layout = optimizeLayout(tiles, 'long-side-along-wall')
    expect(layout.metrics.pairWidthMismatchesMm).toContain(10.1)
    expect(tiles).toEqual(snapshot)
  })

  it('swaps selected ids, recomputes metrics, and preserves immutable input', () => {
    const original = optimizeLayout([tile('a', 100), tile('b', 90), tile('c', 80), tile('d', 70)], 'long-side-along-wall')
    const snapshot = structuredClone(original)
    const swapped = swapTiles(original, { row: 'upper', position: 0 }, { row: 'lower', position: 0 })
    expect(swapped.slots[0]).toEqual({ position: 0, upperTileId: original.slots[0].lowerTileId, lowerTileId: original.slots[0].upperTileId })
    expect(original).toEqual(snapshot)
    expect(swapTiles(original, { row: 'upper', position: 0 }, { row: 'upper', position: 0 })).toEqual(original)
    expect(() => swapTiles(original, { row: 'upper', position: 9 } as SlotAddress, { row: 'lower', position: 0 })).toThrow(RangeError)
    expect(() => swapTiles(original, { row: 'middle' as never, position: 0 }, { row: 'lower', position: 0 })).toThrow(RangeError)
  })

  it('swaps a layout restored through structured clone when tiles are supplied', () => {
    const tiles = [tile('a', 100), tile('b', 90)]
    const restored = structuredClone(optimizeLayout(tiles, 'long-side-along-wall'))
    expect(() => swapTiles(restored, { row: 'upper', position: 0 }, { row: 'lower', position: 0 }, tiles)).not.toThrow()
    expect(swapTiles(restored, { row: 'upper', position: 0 }, { row: 'lower', position: 0 }, tiles).metrics.pairWidthMismatchesMm).toEqual([10])
  })

  it('freezes each emitted slot object', () => {
    const layout = optimizeLayout([tile('a', 100), tile('b', 90)], 'long-side-along-wall')
    expect(() => {
      ;(layout.slots[0] as { upperTileId: string }).upperTileId = 'changed'
    }).toThrow(TypeError)
    expect(layout.slots[0].upperTileId).not.toBe('changed')
  })

  it('freezes swapped slot and metric objects', () => {
    const layout = optimizeLayout([tile('a', 100), tile('b', 90)], 'long-side-along-wall')
    const swapped = swapTiles(layout, { row: 'upper', position: 0 }, { row: 'lower', position: 0 })
    expect(Object.isFrozen(swapped.slots[0])).toBe(true)
    expect(Object.isFrozen(swapped.metrics)).toBe(true)
    expect(Object.isFrozen(swapped.metrics.pairWidthMismatchesMm)).toBe(true)
  })
})
