/*
 * Share links, without accounts. Publishing returns a short id and a secret edit token; only the token's
 * SHA-256 is stored, and the token is needed to update or delete the share or upload its media.
 * Projects are JSON in KV (`share:<id>`), media are R2 objects (`s/<id>/<assetId>`).
 */
import { type Context, Hono } from 'hono'
import { defaultProject } from '../src/lib/defaults'
import { APPS, ASSET_ID_RE, sanitizeProject } from '../src/lib/project-schema'
import type { AppKind, Project } from '../src/lib/types'
import { bearerMatches, randomId, randomToken, sha256Hex } from './crypto'
import { ApiError, type AppEnv, invalid, log, notFound, readJson } from './http'
import { clientKey, rateLimit, spendDaily } from './limits'
import { type AssetKind, contentRange, looksLike, mediaHeaders, peekBody, SNIFF_BYTES } from './media'

export interface ShareAsset {
  id: string
  kind: AssetKind
  type: string
  size: number
  name?: string
}

export interface ShareRecord {
  id: string
  title: string
  /** The messenger the story shows, as the app resolved it (an `@app` line in the script wins over the setting). */
  app?: AppKind
  project: Project
  assets: ShareAsset[]
  createdAt: number
  updatedAt: number
  tokenHash: string
}

const MAX_BODY_BYTES = 320 * 1024
const MAX_ASSETS = 40
const MAX_ASSET_BYTES: Record<AssetKind, number> = { image: 8e6, audio: 25e6, video: 90e6 }
const MAX_TOTAL_BYTES = 160e6
const KINDS = Object.keys(MAX_ASSET_BYTES) as AssetKind[]
// Media types a share may contain. No SVG: it can carry scripts.
const MEDIA_TYPE_RE: Record<AssetKind, RegExp> = {
  image: /^image\/(png|jpe?g|webp|gif|avif|hei[cf]|bmp)$/,
  video: /^video\/(mp4|quicktime|webm|x-m4v|3gpp)$/,
  audio: /^audio\/(mpeg|mp3|mp4|aac|wav|x-wav|wave|ogg|webm|x-m4a|m4a|flac|x-flac)$/,
}

/** Route patterns for share and media ids. */
export const SHARE_ID = '[A-Za-z0-9]{6,16}'
const ASSET_ID = ASSET_ID_RE.source.slice(1, -1)

const shareKey = (id: string) => `share:${id}`
const mediaKey = (id: string, assetId: string) => `s/${id}/${assetId}`

export function loadShare(env: Env, id: string): Promise<ShareRecord | null> {
  return env.SHARES.get<ShareRecord>(shareKey(id), 'json')
}

async function requireShare(env: Env, id: string): Promise<ShareRecord> {
  const rec = await loadShare(env, id)
  if (!rec) throw notFound('Share not found')
  return rec
}

async function requireEditToken(req: Request, rec: ShareRecord): Promise<void> {
  if (!(await bearerMatches(req, rec.tokenHash))) throw new ApiError(401, 'unauthorized', 'Invalid edit token')
}

async function unusedId(env: Env): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const id = randomId()
    if (!(await env.SHARES.get(shareKey(id)))) return id
  }
  throw new Error('No free share id')
}

function deleteMedia(env: Env, id: string, assetIds: string[]): Promise<void> {
  return env.MEDIA.delete(assetIds.map((assetId) => mediaKey(id, assetId)))
}

/** Remove the share at once; its media is deleted in the background. */
async function removeShare(c: Context<AppEnv>, rec: ShareRecord): Promise<void> {
  await c.env.SHARES.delete(shareKey(rec.id))
  if (rec.assets.length)
    c.executionCtx.waitUntil(
      deleteMedia(
        c.env,
        rec.id,
        rec.assets.map((a) => a.id),
      ),
    )
}

interface SharePayload {
  title: string
  app: AppKind
  project: Project
  assets: ShareAsset[]
}

/** Validate the body of a create / update request. The project is stored in its sanitized form. */
async function readPayload(req: Request): Promise<SharePayload> {
  const body = (await readJson(req, MAX_BODY_BYTES, 'Project is too large')) as Record<string, unknown> | null
  const raw = body?.project as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object' || typeof raw.script !== 'string') throw invalid('Missing project')
  const project = sanitizeProject(raw, defaultProject())
  const list: unknown[] = Array.isArray(body?.assets) ? body.assets : []
  if (list.length > MAX_ASSETS) throw invalid('Too many media files')
  const assets: ShareAsset[] = []
  let total = 0
  for (const item of list as (Record<string, unknown> | null)[]) {
    const id = item?.id
    if (typeof id !== 'string' || !ASSET_ID_RE.test(id) || assets.some((a) => a.id === id)) throw invalid('Invalid media id')
    const kind = item?.kind as AssetKind
    if (!KINDS.includes(kind)) throw invalid('Invalid media kind')
    const size = Number(item?.size)
    if (!Number.isFinite(size) || size <= 0) throw invalid('Invalid media size')
    if (size > MAX_ASSET_BYTES[kind]) throw new ApiError(413, 'too_large', `${kind} file is too large`)
    const type = String(item?.type ?? '').toLowerCase()
    if (!MEDIA_TYPE_RE[kind].test(type)) throw new ApiError(415, 'unsupported_media', `Unsupported ${kind} format (${type || 'unknown'})`)
    total += size
    assets.push({ id, kind, type, size, name: typeof item?.name === 'string' ? item.name.slice(0, 120) : undefined })
  }
  if (total > MAX_TOTAL_BYTES) throw new ApiError(413, 'too_large', 'Media files are too large in total')
  return {
    title: typeof body?.title === 'string' ? body.title.slice(0, 120) : '',
    app: APPS.includes(body?.app as AppKind) ? (body?.app as AppKind) : project.app,
    project,
    assets,
  }
}

function publicView(rec: ShareRecord) {
  return { id: rec.id, title: rec.title, project: rec.project, assets: rec.assets, createdAt: rec.createdAt, updatedAt: rec.updatedAt }
}

export const shares = new Hono<AppEnv>()

/** Publish a project → `{ id, editToken }`. */
shares.post('/', async (c) => {
  const who = clientKey(c.req.raw)
  await rateLimit(c.env.SHARE_LIMIT, who)
  const payload = await readPayload(c.req.raw)
  await spendDaily(c.env, who, 'shares', 1)
  const id = await unusedId(c.env)
  const token = randomToken()
  const now = Date.now()
  const rec: ShareRecord = { id, ...payload, createdAt: now, updatedAt: now, tokenHash: await sha256Hex(token) }
  await c.env.SHARES.put(shareKey(id), JSON.stringify(rec))
  log('share.created', { id, assets: rec.assets.length, bytes: rec.assets.reduce((n, a) => n + a.size, 0) })
  return c.json({ id, editToken: token }, 201)
})

/** The shared project and its media list. */
shares.get(`/:id{${SHARE_ID}}`, async (c) => {
  const rec = await requireShare(c.env, c.req.param('id'))
  return c.json(publicView(rec), 200, { 'cache-control': 'public, max-age=30', 'x-robots-tag': 'noindex' })
})

/** Replace the project (edit token). */
shares.put(`/:id{${SHARE_ID}}`, async (c) => {
  await rateLimit(c.env.SHARE_LIMIT, clientKey(c.req.raw))
  const rec = await requireShare(c.env, c.req.param('id'))
  await requireEditToken(c.req.raw, rec)
  const payload = await readPayload(c.req.raw)
  const next: ShareRecord = { ...rec, ...payload, updatedAt: Date.now() }
  await c.env.SHARES.put(shareKey(rec.id), JSON.stringify(next))
  // Media the project no longer uses is deleted only after the new version is stored.
  const keep = new Set(next.assets.map((a) => a.id))
  const dropped = rec.assets.filter((a) => !keep.has(a.id)).map((a) => a.id)
  if (dropped.length) c.executionCtx.waitUntil(deleteMedia(c.env, rec.id, dropped))
  log('share.updated', { id: rec.id, assets: next.assets.length })
  return c.json({ id: rec.id })
})

/** Stop sharing (edit token). */
shares.delete(`/:id{${SHARE_ID}}`, async (c) => {
  await rateLimit(c.env.SHARE_LIMIT, clientKey(c.req.raw))
  const rec = await requireShare(c.env, c.req.param('id'))
  await requireEditToken(c.req.raw, rec)
  await removeShare(c, rec)
  log('share.deleted', { id: rec.id })
  return c.json({ ok: true })
})

/** Upload one of the media files listed in the share (edit token). Streamed into R2, never buffered. */
shares.put(`/:id{${SHARE_ID}}/assets/:assetId{${ASSET_ID}}`, async (c) => {
  const who = clientKey(c.req.raw)
  await rateLimit(c.env.UPLOAD_LIMIT, who)
  const rec = await requireShare(c.env, c.req.param('id'))
  await requireEditToken(c.req.raw, rec)
  const assetId = c.req.param('assetId')
  const meta = rec.assets.find((a) => a.id === assetId)
  if (!meta) throw invalid('Media is not part of this share')
  const length = Number(c.req.header('content-length'))
  const body = c.req.raw.body
  if (!length || !body) throw new ApiError(411, 'length_required', 'Content-Length required')
  // Sizes were checked against the limits when the share was saved.
  if (length > meta.size) throw new ApiError(413, 'too_large', 'File is larger than declared')
  const upload = await peekBody(body, length, SNIFF_BYTES)
  if (!looksLike(meta.kind, upload.head)) {
    await upload.body.cancel()
    log('upload.rejected', { id: rec.id, assetId, kind: meta.kind, type: meta.type })
    throw new ApiError(415, 'unsupported_media', `Not a valid ${meta.kind} file`)
  }
  try {
    await spendDaily(c.env, who, 'bytes', length)
  } catch (e) {
    await upload.body.cancel()
    throw e
  }
  try {
    await c.env.MEDIA.put(mediaKey(rec.id, assetId), upload.body, { httpMetadata: { contentType: meta.type } })
  } catch (e) {
    if (await upload.failed()) throw invalid('The upload was incomplete')
    throw e
  }
  return c.json({ ok: true })
})

/** Download a media file (`thumb` is the link-preview image). Supports conditional and range requests. */
shares.get(`/:id{${SHARE_ID}}/assets/:assetId{${ASSET_ID}}`, async (c) => {
  const rec = await requireShare(c.env, c.req.param('id'))
  const assetId = c.req.param('assetId')
  if (!rec.assets.some((a) => a.id === assetId)) throw notFound('Media not found')
  const req = c.req.raw.headers
  const key = mediaKey(rec.id, assetId)
  // An unusual Range header shouldn't fail the download: ignoring it and sending the whole file is valid HTTP.
  const obj = await c.env.MEDIA.get(key, { onlyIf: req, range: req }).catch(() => c.env.MEDIA.get(key, { onlyIf: req }))
  if (!obj) throw notFound('Media not found')
  const headers = mediaHeaders(obj, assetId === 'thumb')
  if (!('body' in obj)) {
    const failedPrecondition = req.has('if-match') || req.has('if-unmodified-since')
    return new Response(null, { status: failedPrecondition ? 412 : 304, headers })
  }
  const range = contentRange(obj, req.has('range'))
  if (range) headers.set('content-range', range)
  return new Response(obj.body, { status: range ? 206 : 200, headers })
})

export const admin = new Hono<AppEnv>()

/**
 * Takedown: remove any share. Needs the ADMIN_TOKEN secret (`npx wrangler secret put ADMIN_TOKEN`);
 * without it this route doesn't exist.
 */
admin.delete(`/shares/:id{${SHARE_ID}}`, async (c) => {
  const secret = (c.env as { ADMIN_TOKEN?: string }).ADMIN_TOKEN
  if (!secret) throw notFound()
  await rateLimit(c.env.SHARE_LIMIT, clientKey(c.req.raw))
  if (!(await bearerMatches(c.req.raw, await sha256Hex(secret)))) throw new ApiError(401, 'unauthorized', 'Invalid admin token')
  const rec = await requireShare(c.env, c.req.param('id'))
  await removeShare(c, rec)
  log('share.removed_by_admin', { id: rec.id })
  return c.json({ ok: true })
})
