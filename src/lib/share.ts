import { assetInfo, putAsset } from './assets'
import { migrateProject } from './defaults'
import type { ProjectMeta, ShareInfo } from './projects'
import { parseScript } from './script'
import { renderOgImage } from './snapshots'
import { derive } from './store'
import type { Project } from './types'

export interface SharedAsset {
  id: string
  kind: 'image' | 'video' | 'audio'
  type: string
  size: number
  name?: string
}

export interface SharedProject {
  id: string
  title: string
  project: Project
  assets: SharedAsset[]
  createdAt: number
  updatedAt: number
}

export function shareUrl(id: string): string {
  return `${location.origin}/s/${id}`
}

/** Every media asset a project references. */
export function projectAssetIds(project: Project): string[] {
  const ids = new Set<string>()
  const add = (id?: string | null) => {
    if (id) ids.add(id)
  }
  add(project.chat.avatar)
  add(project.chat.wallpaper)
  add(project.background.asset)
  add(project.sound.music)
  project.participants.forEach((p) => add(p.avatar))
  for (const m of parseScript(project.script).messages) if (m.kind === 'image') add(m.image)
  return [...ids]
}

/** Reasons the API gives with an error (see worker/http.ts). */
export type ShareErrorCode =
  'invalid_request' | 'not_found' | 'unauthorized' | 'length_required' | 'too_large' | 'unsupported_media' | 'rate_limited' | 'quota_exceeded' | 'server_error'

/** An API error with its HTTP status and reason, so the UI can explain it in the user's language. */
export class ShareError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: ShareErrorCode,
  ) {
    super(message)
  }
}

async function failure(res: Response): Promise<ShareError> {
  const body = (await res.json().catch(() => null)) as { error?: string; code?: ShareErrorCode } | null
  return new ShareError(body?.error ?? `Request failed (${res.status})`, res.status, body?.code)
}

export interface PublishProgress {
  step: 'preparing' | 'uploading'
  done: number
  total: number
}

/** Create the share link, or update the existing one. Returns the share info to store on the project. */
export async function publishProject(
  meta: ProjectMeta,
  project: Project,
  title: string,
  onProgress: (p: PublishProgress) => void = () => {},
): Promise<ShareInfo> {
  onProgress({ step: 'preparing', done: 0, total: 0 })
  const { effective, timeline } = derive(project)
  const infos = (await Promise.all(projectAssetIds(project).map(assetInfo))).filter((x): x is NonNullable<typeof x> => !!x)
  const og = await renderOgImage(effective, timeline, title)
  const assets: SharedAsset[] = [
    ...infos.map((i) => ({ id: i.id, kind: i.kind, type: i.type, size: i.size, name: i.name })),
    { id: 'thumb', kind: 'image', type: 'image/jpeg', size: og.size, name: 'preview.jpg' },
  ]
  // `app` is the messenger the story really shows (the script can override the setting), for link previews.
  const body = JSON.stringify({ title, app: effective.app, project, assets })

  let share = meta.share
  if (share) {
    const res = await fetch(`/api/shares/${share.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${share.token}` },
      body,
    })
    if (res.status === 404 || res.status === 401) share = undefined
    else if (!res.ok) throw await failure(res)
  }
  if (!share) {
    const res = await fetch('/api/shares', { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    if (!res.ok) throw await failure(res)
    const { id, editToken } = (await res.json()) as { id: string; editToken: string }
    share = { id, token: editToken, uploaded: [], sharedAt: Date.now() }
  }

  const uploads: { id: string; blob: Blob; type: string }[] = [
    ...infos.filter((i) => !share!.uploaded.includes(i.id)).map((i) => ({ id: i.id, blob: i.blob, type: i.type })),
    { id: 'thumb', blob: og, type: 'image/jpeg' },
  ]
  let done = 0
  onProgress({ step: 'uploading', done, total: uploads.length })
  for (const u of uploads) {
    const res = await fetch(`/api/shares/${share.id}/assets/${u.id}`, {
      method: 'PUT',
      headers: { 'content-type': u.type, authorization: `Bearer ${share.token}` },
      body: u.blob,
    })
    if (!res.ok) throw await failure(res)
    done++
    onProgress({ step: 'uploading', done, total: uploads.length })
  }
  return { ...share, uploaded: [...new Set([...share.uploaded, ...infos.map((i) => i.id)])], sharedAt: Date.now() }
}

export async function unpublish(share: ShareInfo): Promise<void> {
  const res = await fetch(`/api/shares/${share.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${share.token}` } })
  if (!res.ok && res.status !== 404) throw await failure(res)
}

export async function fetchShare(id: string): Promise<SharedProject> {
  const res = await fetch(`/api/shares/${encodeURIComponent(id)}`)
  if (!res.ok) throw await failure(res)
  const data = (await res.json()) as Omit<SharedProject, 'project'> & { project: unknown }
  return { ...data, project: migrateProject(data.project) }
}

/** Download the media of a shared project. `persist` = keep it in IndexedDB (when remixing). */
export async function loadShareAssets(shared: SharedProject, persist: boolean, onProgress: (done: number, total: number) => void = () => {}): Promise<void> {
  const list = shared.assets.filter((a) => a.id !== 'thumb')
  let done = 0
  onProgress(done, list.length)
  await Promise.all(
    list.map(async (a) => {
      const res = await fetch(`/api/shares/${shared.id}/assets/${a.id}`)
      if (res.ok) await putAsset(a.id, await res.blob(), a.name ?? a.id, persist)
      onProgress(++done, list.length)
    }),
  )
}
