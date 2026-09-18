import { beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { normalizeTile } from '../../domain/tile'
import { optimizeLayout, swapTiles } from '../../domain/layout'
import {
  createProject,
  db,
  createProjectDatabase,
  loadProject,
  listProjects,
  saveProject,
  ProjectNameConflictError,
  ProjectValidationError,
} from '../database'
import type { ProjectSnapshot } from '../../domain/project'

const tiles = [normalizeTile('a', 100, 50), normalizeTile('b', 90, 50)]
const settings = { orientation: 'long-side-along-wall' as const, groutMm: 2, toleranceMm: 1 }

function input(name = 'Bathroom') {
  return { name, tiles, settings, layout: optimizeLayout(tiles, settings.orientation) }
}

beforeEach(async () => {
  await db.projects.clear()
})

describe('project persistence', () => {
  it('creates, lists, and loads a complete project', async () => {
    const created = await createProject(input())
    expect(created.id).toEqual(expect.any(String))
    expect(created.name).toBe('Bathroom')
    expect(created.nameKey).toBe('bathroom')
    expect(await listProjects()).toEqual([created])
    expect(await loadProject(created.id)).toEqual(created)
  })

  it('lists projects newest updated first', async () => {
    const first = await createProject(input('First'))
    const second = await createProject(input('Second'))
    const newest = await saveProject({ ...first, name: 'First renamed' })
    expect((await listProjects()).map((project) => project.id)).toEqual([newest.id, second.id])
  })

  it('trims names and rejects case-folded duplicate names', async () => {
    const project = await createProject(input('  Kitchen  '))
    expect(project.name).toBe('Kitchen')
    expect(project.nameKey).toBe('kitchen')
    await expect(createProject(input('KITCHEN'))).rejects.toBeInstanceOf(ProjectNameConflictError)
    await expect(createProject(input('   '))).rejects.toBeInstanceOf(ProjectValidationError)
  })

  it('rejects saving a project with another project\'s name', async () => {
    await createProject(input('First'))
    const second = await createProject(input('Second'))
    const third = await createProject(input('Third'))
    const results = await Promise.allSettled([
      saveProject({ ...second, name: 'Collision' }),
      saveProject({ ...third, name: 'Collision' }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected' && result.reason instanceof ProjectNameConflictError)).toHaveLength(1)
  })

  it('persists source and normalized tiles, settings, and manual layout swaps', async () => {
    const swapped = swapTiles(input().layout, { row: 'upper', position: 0 }, { row: 'lower', position: 0 })
    const project = await createProject({ ...input(), layout: swapped })
    const loaded = await loadProject(project.id)
    expect(loaded?.tiles).toEqual(tiles)
    expect(loaded?.settings).toEqual(settings)
    expect(loaded?.layout).toEqual(swapped)
  })

  it('preserves createdAt and advances updatedAt on save', async () => {
    const project = await createProject(input())
    const updated = await saveProject({ ...project, name: 'Updated' })
    expect(updated.createdAt).toBe(project.createdAt)
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(project.updatedAt).getTime())
  })

  it('isolates snapshots from caller and loader mutation', async () => {
    const project = await createProject(input())
    project.tiles[0].inputWidthMm = 999
    const loaded = await loadProject(project.id)
    expect(loaded?.tiles[0].inputWidthMm).toBe(100)
    loaded!.tiles[0].inputWidthMm = 888
    expect((await loadProject(project.id))?.tiles[0].inputWidthMm).toBe(100)
  })

  it('updates an existing id and reports missing ids', async () => {
    const project = await createProject(input())
    const saved = await saveProject({ ...project, name: 'New name' })
    expect(saved.id).toBe(project.id)
    expect(await loadProject('missing')).toBeUndefined()
  })

  it('accepts a typed project snapshot on save', async () => {
    const project = await createProject(input())
    const snapshot: ProjectSnapshot = { ...project, name: 'Snapshot' }
    expect((await saveProject(snapshot)).name).toBe('Snapshot')
  })

  it('migrates legacy duplicate name keys before creating the unique index', async () => {
    const databaseName = 'flisplan-migration-test'
    await Dexie.delete(databaseName)
    const legacy = new Dexie(databaseName)
    legacy.version(1).stores({ projects: '&id,nameKey,updatedAt' })
    const table = legacy.table('projects')
    await legacy.open()
    await table.bulkAdd([
      { ...createLegacySnapshot('b', 'Bathroom'), nameKey: 'bathroom' },
      { ...createLegacySnapshot('a', 'Bath Room'), nameKey: 'bathroom' },
      { ...createLegacySnapshot('c', 'Legacy candidate'), nameKey: 'bathroom~b' },
    ])
    legacy.close()

    const migrated = createProjectDatabase(databaseName)
    const projects = await migrated.projects.orderBy('id').toArray()
    expect(projects.map((project) => project.name)).toEqual(['Bath Room', 'Bathroom', 'Legacy candidate'])
    expect(projects.map((project) => project.nameKey)).toEqual(['bathroom', 'bathroom~b~1', 'bathroom~b'])
    expect(migrated.projects.schema.indexes.find((index) => index.name === 'nameKey')?.unique).toBe(true)
    migrated.close()
    await Dexie.delete(databaseName)
  })
})

function createLegacySnapshot(id: string, name: string) {
  const project = { name, tiles, settings, layout: optimizeLayout(tiles, settings.orientation) }
  return { ...project, id, nameKey: name.toLowerCase(), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
}
