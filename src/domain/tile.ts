export type WallOrientation = 'long-side-along-wall' | 'short-side-along-wall'

export interface Tile {
  id: string
  inputWidthMm: number
  inputHeightMm: number
  longMm: number
  shortMm: number
}

function assertDimension(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError('Tile dimensions must be finite and positive')
  }
}

export function normalizeTile(id: string, width: number, height: number): Tile {
  assertDimension(width)
  assertDimension(height)
  return {
    id,
    inputWidthMm: width,
    inputHeightMm: height,
    longMm: Math.max(width, height),
    shortMm: Math.min(width, height),
  }
}

export function projectTile(tile: Tile, orientation: WallOrientation): { alongWallMm: number; depthMm: number } {
  if (orientation === 'long-side-along-wall') {
    return { alongWallMm: tile.longMm, depthMm: tile.shortMm }
  }
  if (orientation === 'short-side-along-wall') {
    return { alongWallMm: tile.shortMm, depthMm: tile.longMm }
  }
  throw new RangeError(`Unknown wall orientation: ${String(orientation)}`)
}
