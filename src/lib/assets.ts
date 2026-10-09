import { del, get, set } from 'idb-keyval'

export type AssetKind = 'image' | 'video' | 'audio'

interface Entry {
  id: string
  kind: AssetKind
  name: string
  blob: Blob
  url: string
  image?: HTMLImageElement
  video?: HTMLVideoElement
}

const entries = new Map<string, Entry>()
const loading = new Map<string, Promise<Entry | null>>()
const listeners = new Set<() => void>()
let version = 0

export function onAssetsChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function assetsVersion(): number {
  return version
}

function emit() {
  version++
  listeners.forEach((l) => l())
}

function kindOf(blob: Blob): AssetKind {
  if (blob.type.startsWith('video/')) return 'video'
  if (blob.type.startsWith('audio/')) return 'audio'
  return 'image'
}

async function downscaleImage(file: Blob, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
    if (s >= 1 && file.size < 1.5e6) {
      bmp.close()
      return file
    }
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * s)
    c.height = Math.round(bmp.height * s)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    const hasAlpha = file.type === 'image/png' || file.type === 'image/webp'
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), hasAlpha ? 'image/png' : 'image/jpeg', 0.9))
  } catch {
    return file
  }
}

async function materialize(id: string, kind: AssetKind, name: string, blob: Blob): Promise<Entry> {
  const url = URL.createObjectURL(blob)
  const e: Entry = { id, kind, name, blob, url }
  if (kind === 'image') {
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      /* broken image */
    }
    e.image = img
  } else if (kind === 'video') {
    const v = document.createElement('video')
    v.src = url
    v.muted = true
    v.loop = true
    v.playsInline = true
    v.preload = 'auto'
    v.crossOrigin = 'anonymous'
    await new Promise<void>((res) => {
      v.onloadeddata = () => res()
      v.onerror = () => res()
      setTimeout(res, 4000)
    })
    e.video = v
  }
  entries.set(id, e)
  return e
}

export async function addAsset(file: Blob, name = 'file'): Promise<string> {
  const id = Math.random().toString(36).slice(2, 10)
  const kind = kindOf(file)
  const blob = kind === 'image' ? await downscaleImage(file) : file
  await set(`asset:${id}`, { kind, name, blob })
  await materialize(id, kind, name, blob)
  emit()
  return id
}

export async function addAssetFromUrl(url: string, name: string): Promise<string> {
  const res = await fetch(url)
  return addAsset(await res.blob(), name)
}

export function loadAsset(id: string | null | undefined): Promise<Entry | null> {
  if (!id) return Promise.resolve(null)
  const e = entries.get(id)
  if (e) return Promise.resolve(e)
  let p = loading.get(id)
  if (!p) {
    p = (async () => {
      const rec = (await get(`asset:${id}`)) as { kind: AssetKind; name: string; blob: Blob } | undefined
      if (!rec) return null
      const entry = await materialize(id, rec.kind, rec.name, rec.blob)
      emit()
      return entry
    })()
    loading.set(id, p)
  }
  return p
}

export async function loadAssets(ids: (string | null | undefined)[]): Promise<void> {
  await Promise.all(ids.filter(Boolean).map((id) => loadAsset(id)))
}

export function getImage(id: string | null | undefined): HTMLImageElement | null {
  if (!id) return null
  const e = entries.get(id)
  if (!e) {
    void loadAsset(id)
    return null
  }
  return e.image && e.image.naturalWidth ? e.image : null
}

export function getVideo(id: string | null | undefined): HTMLVideoElement | null {
  if (!id) return null
  const e = entries.get(id)
  if (!e) {
    void loadAsset(id)
    return null
  }
  return e.video ?? null
}

export function getAssetBlob(id: string | null | undefined): Blob | null {
  if (!id) return null
  return entries.get(id)?.blob ?? null
}

export function getAssetName(id: string | null | undefined): string {
  if (!id) return ''
  return entries.get(id)?.name ?? ''
}

export async function removeAsset(id: string): Promise<void> {
  const e = entries.get(id)
  if (e) URL.revokeObjectURL(e.url)
  entries.delete(id)
  await del(`asset:${id}`)
  emit()
}

/** Store a blob under a known id (shared projects keep their asset ids). `persist` = also save to IndexedDB. */
export async function putAsset(id: string, blob: Blob, name = 'file', persist = true): Promise<void> {
  if (entries.has(id)) return
  const kind = kindOf(blob)
  if (persist) await set(`asset:${id}`, { kind, name, blob })
  await materialize(id, kind, name, blob)
  emit()
}

export async function assetInfo(id: string): Promise<{ id: string; kind: AssetKind; type: string; size: number; name: string; blob: Blob } | null> {
  const e = (await loadAsset(id)) ?? null
  if (!e) return null
  return {
    id,
    kind: e.kind,
    type: e.blob.type || (e.kind === 'image' ? 'image/jpeg' : e.kind === 'video' ? 'video/mp4' : 'audio/mpeg'),
    size: e.blob.size,
    name: e.name,
    blob: e.blob,
  }
}

/** Save an in-memory asset (e.g. from a shared project) to IndexedDB. */
export async function persistAsset(id: string): Promise<void> {
  const e = entries.get(id)
  if (!e) return
  if (await get(`asset:${id}`)) return
  await set(`asset:${id}`, { kind: e.kind, name: e.name, blob: e.blob })
}
