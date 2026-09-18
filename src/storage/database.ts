import Dexie, { type Table } from 'dexie'
import type { Layout } from '../domain/layout'
import type { ProjectSettings, ProjectSnapshot } from '../domain/project'
import type { Tile } from '../domain/tile'

export type NewProject = {
  name: string
  tiles: Tile[]
  settings: ProjectSettings
  layout: Layout
}

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectValidationError'
  }
}

export class ProjectNameConflictError extends Error {
  constructor(name: string) {
    super(`A project named "${name}" already exists`)
    this.name = 'ProjectNameConflictError'
  }
}

export class ProjectStorageError extends Error {
  override readonly cause: unknown

  constructor(message: string, cause: unknown) {
    super(message)
    this.name = 'ProjectStorageError'
    this.cause = cause
  }
}

export class ProjectDatabase extends Dexie {
  projects!: Table<ProjectSnapshot, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({ projects: '&id,nameKey,updatedAt' })
    this.version(2).stores({ projects: '&id,nameKey,updatedAt' }).upgrade(async (transaction) => {
      const table = transaction.table('projects')
      const projects = await table.toArray() as ProjectSnapshot[]
      const usedKeys = new Set(projects.map((project) => project.nameKey))
      const seen = new Set<string>()
      for (const project of projects.sort((a, b) => a.id.localeCompare(b.id))) {
        const originalKey = project.nameKey
        if (seen.has(originalKey)) {
          let suffix = 0
          let candidate = `${originalKey}~${project.id}`
          while (usedKeys.has(candidate)) candidate = `${originalKey}~${project.id}~${++suffix}`
          project.nameKey = candidate
          await table.put(project)
          usedKeys.add(candidate)
        }
        seen.add(originalKey)
      }
    })
    this.version(3).stores({ projects: '&id,&nameKey,updatedAt' })
  }
}

export function createProjectDatabase(name = 'flisplan'): ProjectDatabase {
  return new ProjectDatabase(name)
}

export const db = createProjectDatabase()

const copy = <T>(value: T): T => structuredClone(value)

function nameKey(name: string): string {
  return name.normalize('NFKC').toLowerCase()
}

function cleanName(name: unknown): string {
  if (typeof name !== 'string') throw new ProjectValidationError('Project name must be a string')
  const cleaned = name.trim()
  if (!cleaned) throw new ProjectValidationError('Project name cannot be empty')
  return cleaned
}

function nowIso(): string {
  return new Date().toISOString()
}

function nextTimestamp(...previousValues: Array<string | undefined>): string {
  const now = Date.now()
  const priorValues = previousValues.map((value) => value ? Date.parse(value) : Number.NaN).filter(Number.isFinite)
  const prior = priorValues.length ? Math.max(...priorValues) : Number.NaN
  return new Date(Number.isFinite(prior) && prior >= now ? prior + 1 : now).toISOString()
}

async function withStorageErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof ProjectValidationError || error instanceof ProjectNameConflictError || error instanceof ProjectStorageError) throw error
    if (error instanceof Error && error.name === 'ConstraintError') throw new ProjectNameConflictError('That name')
    throw new ProjectStorageError('Unable to access project storage', error)
  }
}

async function ensureNameAvailable(key: string, id?: string): Promise<void> {
  const match = await db.projects.where('nameKey').equals(key).first()
  if (match && match.id !== id) throw new ProjectNameConflictError(match.name)
}

export async function createProject(input: NewProject): Promise<ProjectSnapshot> {
  return withStorageErrors(async () => {
    const name = cleanName(input.name)
    const key = nameKey(name)
    return db.transaction('rw', db.projects, async () => {
      await ensureNameAvailable(key)
      const latest = await db.projects.orderBy('updatedAt').reverse().first()
      const timestamp = latest ? nextTimestamp(latest.updatedAt) : nowIso()
      const project: ProjectSnapshot = {
        id: crypto.randomUUID(),
        name,
        nameKey: key,
        createdAt: timestamp,
        updatedAt: timestamp,
        tiles: copy(input.tiles),
        settings: copy(input.settings),
        layout: copy(input.layout),
      }
      await db.projects.add(copy(project))
      return copy(project)
    })
  })
}

export async function saveProject(snapshot: ProjectSnapshot): Promise<ProjectSnapshot> {
  return withStorageErrors(async () => {
    const name = cleanName(snapshot.name)
    const key = nameKey(name)
    return db.transaction('rw', db.projects, async () => {
      const existing = await db.projects.get(snapshot.id)
      await ensureNameAvailable(key, snapshot.id)
      const latest = await db.projects.orderBy('updatedAt').reverse().first()
      const project: ProjectSnapshot = {
        ...copy(snapshot),
        name,
        nameKey: key,
        createdAt: existing?.createdAt ?? snapshot.createdAt,
        updatedAt: nextTimestamp(existing?.updatedAt ?? snapshot.updatedAt, latest?.updatedAt),
      }
      await db.projects.put(copy(project))
      return copy(project)
    })
  })
}

export async function listProjects(): Promise<ProjectSnapshot[]> {
  return withStorageErrors(async () => {
    const projects = await db.projects.orderBy('updatedAt').reverse().toArray()
    return projects.map(copy)
  })
}

export async function loadProject(id: string): Promise<ProjectSnapshot | undefined> {
  return withStorageErrors(async () => {
    const project = await db.projects.get(id)
    return project ? copy(project) : undefined
  })
}

export async function deleteProject(id: string): Promise<void> {
  return withStorageErrors(async () => {
    await db.projects.delete(id)
  })
}
