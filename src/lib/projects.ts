import { del, get, set } from 'idb-keyval'
import { migrateProject } from './defaults'
import type { Project } from './types'

/** Where a project was shared, plus the secret token that allows updating that share. */
export interface ShareInfo {
  id: string
  token: string
  /** Asset ids already uploaded (asset ids are immutable, so they never need re-uploading). */
  uploaded: string[]
  sharedAt: number
}

export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** Small JPEG data URL of the last frame. */
  thumb?: string
  share?: ShareInfo
}

const INDEX = 'projects:index'
const CURRENT = 'chatreel:current-project'
const LEGACY = 'chatreel:project:v1'

// All index writes go through one queue so quick successive saves can't overwrite each other.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn)
  queue = next.catch(() => undefined)
  return next
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3)
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const index = ((await get(INDEX)) as ProjectMeta[] | undefined) ?? []
  return [...index].sort((a, b) => b.updatedAt - a.updatedAt)
}

async function writeIndex(fn: (index: ProjectMeta[]) => ProjectMeta[]): Promise<ProjectMeta[]> {
  return serial(async () => {
    const index = ((await get(INDEX)) as ProjectMeta[] | undefined) ?? []
    const next = fn(index)
    await set(INDEX, next)
    return next
  })
}

export async function loadProjectById(id: string): Promise<Project | null> {
  const raw = await get(`project:${id}`)
  return raw ? migrateProject(raw) : null
}

export async function saveProject(id: string, project: Project): Promise<void> {
  await set(`project:${id}`, project)
  await writeIndex((index) => index.map((m) => (m.id === id ? { ...m, updatedAt: Date.now() } : m)))
}

export async function createProject(project: Project, name: string): Promise<ProjectMeta> {
  const now = Date.now()
  const meta: ProjectMeta = { id: newId(), name, createdAt: now, updatedAt: now }
  await set(`project:${meta.id}`, project)
  await writeIndex((index) => [...index, meta])
  return meta
}

export async function updateMeta(id: string, patch: Partial<ProjectMeta>): Promise<ProjectMeta | null> {
  let out: ProjectMeta | null = null
  await writeIndex((index) =>
    index.map((m) => {
      if (m.id !== id) return m
      out = { ...m, ...patch }
      return out
    }),
  )
  return out
}

export async function deleteProject(id: string): Promise<void> {
  await del(`project:${id}`)
  await writeIndex((index) => index.filter((m) => m.id !== id))
}

export async function duplicateProject(id: string, name: string): Promise<ProjectMeta | null> {
  const p = await loadProjectById(id)
  if (!p) return null
  const meta = await createProject(p, name)
  const src = (await listProjects()).find((m) => m.id === id)
  if (src?.thumb) return updateMeta(meta.id, { thumb: src.thumb })
  return meta
}

export function currentProjectId(): string | null {
  try {
    return localStorage.getItem(CURRENT)
  } catch {
    return null
  }
}

export function setCurrentProjectId(id: string): void {
  try {
    localStorage.setItem(CURRENT, id)
  } catch {
    /* ignore */
  }
}

let initOnce: Promise<{ meta: ProjectMeta; project: Project }> | null = null

/** Open the last used project, migrating the old single-project storage the first time. Safe to call twice. */
export function initProjects(fallback: () => Project, firstName: string): Promise<{ meta: ProjectMeta; project: Project }> {
  initOnce ??= doInitProjects(fallback, firstName)
  return initOnce
}

async function doInitProjects(fallback: () => Project, firstName: string): Promise<{ meta: ProjectMeta; project: Project }> {
  let index = await listProjects()
  if (!index.length) {
    let project = fallback()
    try {
      const legacy = localStorage.getItem(LEGACY)
      if (legacy) project = migrateProject(JSON.parse(legacy))
    } catch {
      /* ignore */
    }
    const meta = await createProject(project, firstName)
    try {
      localStorage.removeItem(LEGACY)
    } catch {
      /* ignore */
    }
    setCurrentProjectId(meta.id)
    return { meta, project }
  }
  const wanted = currentProjectId()
  const meta = index.find((m) => m.id === wanted) ?? index[0]
  const project = (await loadProjectById(meta.id)) ?? fallback()
  setCurrentProjectId(meta.id)
  index = await listProjects()
  return { meta: index.find((m) => m.id === meta.id) ?? meta, project }
}
