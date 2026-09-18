import { projectTile, type Tile, type WallOrientation } from './tile'

export interface LayoutSlot {
  readonly position: number
  readonly upperTileId: string
  readonly lowerTileId: string
}

export interface LayoutMetrics {
  readonly pairWidthMismatchesMm: readonly number[]
  readonly cumulativeSeamDriftMm: readonly number[]
  readonly maximumAbsoluteDriftMm: number
  readonly absoluteFinalDriftMm: number
  readonly totalUpperWidthMm: number
  readonly totalLowerWidthMm: number
}

export interface Layout {
  readonly orientation: WallOrientation
  readonly slots: readonly LayoutSlot[]
  readonly metrics: LayoutMetrics
}

export type SlotAddress = { row: 'upper' | 'lower'; position: number }

type Pair = { first: string; second: string; firstWidth: number; secondWidth: number; mean: number }
type Path = { drift: number; maximum: number; sum: number; signs: boolean[] }
const widthByLayout = new WeakMap<Layout, ReadonlyMap<string, number>>()

const idOrder = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const mm = (tenths: number) => tenths / 10
const freezeSlots = (slots: LayoutSlot[]): LayoutSlot[] => Object.freeze(slots.map((slot) => Object.freeze(slot))) as unknown as LayoutSlot[]

function metricsForSlots(slots: LayoutSlot[], widths: ReadonlyMap<string, number>): LayoutMetrics {
  let drift = 0
  let maximum = 0
  let sum = 0
  let upper = 0
  let lower = 0
  const mismatches: number[] = []
  const cumulative: number[] = []
  for (const slot of slots) {
    const upperWidth = widths.get(slot.upperTileId)
    const lowerWidth = widths.get(slot.lowerTileId)
    if (upperWidth === undefined || lowerWidth === undefined) throw new RangeError('Layout contains an unknown tile id')
    upper += upperWidth
    lower += lowerWidth
    mismatches.push(mm(Math.abs(upperWidth - lowerWidth)))
    drift += upperWidth - lowerWidth
    const absolute = Math.abs(drift)
    maximum = Math.max(maximum, absolute)
    sum += absolute
    cumulative.push(mm(drift))
  }
  return Object.freeze({
    pairWidthMismatchesMm: Object.freeze(mismatches),
    cumulativeSeamDriftMm: Object.freeze(cumulative),
    maximumAbsoluteDriftMm: mm(maximum),
    absoluteFinalDriftMm: mm(Math.abs(drift)),
    totalUpperWidthMm: mm(upper),
    totalLowerWidthMm: mm(lower),
  })
}

function betterPath(a: Path, b: Path): Path {
  if (a.maximum !== b.maximum) return a.maximum < b.maximum ? a : b
  if (a.sum !== b.sum) return a.sum < b.sum ? a : b
  // Prefer the lexicographically stable sign sequence (+ before -).
  for (let i = 0; i < a.signs.length; i++) if (a.signs[i] !== b.signs[i]) return a.signs[i] ? a : b
  return a
}

/**
 * Optimize the v1 two-row layout. Sign balancing is pseudo-polynomial in
 * cumulative drift, which is appropriate for the typical roughly 50-tile input.
 */
export function optimizeLayout(tiles: Tile[], orientation: WallOrientation): Layout {
  if (!Array.isArray(tiles) || tiles.length < 2 || tiles.length % 2 !== 0) {
    throw new RangeError('Layout requires an even number of at least two tiles')
  }
  const ids = new Set<string>()
  for (const tile of tiles) {
    if (typeof tile.id !== 'string' || tile.id.trim().length === 0 || ids.has(tile.id)) throw new RangeError('Layout requires non-empty unique tile ids')
    ids.add(tile.id)
  }
  const projected = tiles.map((tile) => {
    const projection = projectTile(tile, orientation)
    return { id: tile.id, width: Math.round(projection.alongWallMm * 10) }
  }).sort((a, b) => a.width - b.width || idOrder(a.id, b.id))
  const pairs: Pair[] = []
  for (let i = 0; i < projected.length; i += 2) {
    const first = projected[i]
    const second = projected[i + 1]
    pairs.push({ first: first.id, second: second.id, firstWidth: first.width, secondWidth: second.width, mean: first.width + second.width })
  }
  pairs.sort((a, b) => a.mean - b.mean || idOrder(a.first, b.first) || idOrder(a.second, b.second))

  let paths = new Map<number, Path>([[0, { drift: 0, maximum: 0, sum: 0, signs: [] }]])
  for (const pair of pairs) {
    const next = new Map<number, Path>()
    for (const path of paths.values()) {
      for (const sign of [true, false]) {
        const delta = sign ? pair.firstWidth - pair.secondWidth : pair.secondWidth - pair.firstWidth
        const drift = path.drift + delta
        const candidate: Path = { drift, maximum: Math.max(path.maximum, Math.abs(drift)), sum: path.sum + Math.abs(drift), signs: [...path.signs, sign] }
        const existing = next.get(drift)
        next.set(drift, existing ? betterPath(existing, candidate) : candidate)
      }
    }
    paths = next
  }
  let best: Path | undefined
  for (const path of paths.values()) {
    if (!best || path.maximum < best.maximum || (path.maximum === best.maximum && (Math.abs(path.drift) < Math.abs(best.drift) || (Math.abs(path.drift) === Math.abs(best.drift) && path.sum < best.sum)))) best = path
  }
  if (!best) throw new RangeError('Unable to optimize layout')
  const slots = pairs.map((pair, position) => best!.signs[position]
    ? { position, upperTileId: pair.first, lowerTileId: pair.second }
    : { position, upperTileId: pair.second, lowerTileId: pair.first })
  const widths = new Map(projected.map((item) => [item.id, item.width]))
  const layout: Layout = Object.freeze({ orientation, slots: freezeSlots(slots), metrics: metricsForSlots(slots, widths) })
  widthByLayout.set(layout, widths)
  return layout
}

export function swapTiles(layout: Layout, source: SlotAddress, target: SlotAddress, tiles?: readonly Tile[]): Layout {
  const widths = widthByLayout.get(layout) ?? (tiles ? new Map(tiles.map((tile) => [tile.id, Math.round(projectTile(tile, layout.orientation).alongWallMm * 10)])) : undefined)
  if (!widths) throw new RangeError('Layout was not produced by optimizeLayout')
  const valid = (address: SlotAddress) => address && (address.row === 'upper' || address.row === 'lower') && Number.isInteger(address.position) && address.position >= 0 && address.position < layout.slots.length
  if (!valid(source) || !valid(target)) throw new RangeError('Invalid layout slot address')
  if (source.row === target.row && source.position === target.position) return layout
  const slots = layout.slots.map((slot) => ({ ...slot }))
  const get = (address: SlotAddress) => address.row === 'upper' ? slots[address.position].upperTileId : slots[address.position].lowerTileId
  const set = (address: SlotAddress, id: string) => { if (address.row === 'upper') slots[address.position].upperTileId = id; else slots[address.position].lowerTileId = id }
  const sourceId = get(source)
  set(source, get(target)); set(target, sourceId)
  const result: Layout = Object.freeze({ orientation: layout.orientation, slots: freezeSlots(slots), metrics: metricsForSlots(slots, widths) })
  widthByLayout.set(result, widths)
  return result
}
