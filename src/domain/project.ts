import type { Layout } from './layout'
import type { Tile, WallOrientation } from './tile'

export interface ProjectSettings {
  orientation: WallOrientation
  groutMm: number
  toleranceMm: number
}

export interface ProjectSnapshot {
  id: string
  name: string
  nameKey: string
  createdAt: string
  updatedAt: string
  tiles: Tile[]
  settings: ProjectSettings
  layout: Layout
}
