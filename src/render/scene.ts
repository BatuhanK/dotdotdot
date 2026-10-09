import type { ChatStrings } from '../lib/i18n'
import type { Timeline } from '../lib/timeline'
import type { Project } from '../lib/types'
import type { DeviceSpec } from './devices'
import { presence, type Ctx } from './util'

export interface SceneInput {
  project: Project
  timeline: Timeline
  device: DeviceSpec
  /** Logical screen size in points. */
  width: number
  height: number
  /** Output pixels per point (for shadow blur, which ignores the canvas transform). */
  scale: number
  strings: ChatStrings
}

export interface HitRect {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface ChatScene {
  draw(ctx: Ctx, t: number): void
  hitTest(x: number, y: number): string | null
}

export interface Entry {
  key: string
  inAt: number
  outAt: number
  inDur?: number
  outDur?: number
  height: (t: number) => number
  gap: number
  /** Draw at `top` (already scrolled). `p` is the entry's presence 0..1. */
  draw: (ctx: Ctx, top: number, p: number, t: number, hits: HitRect[]) => void
}

export interface Placed {
  e: Entry
  y: number
  h: number
  p: number
}

export function layoutEntries(entries: Entry[], t: number, top: number): { placed: Placed[]; bottom: number } {
  const placed: Placed[] = []
  let y = top
  for (const e of entries) {
    const p = presence(t, e.inAt, e.outAt, e.inDur, e.outDur)
    if (p <= 0.0005) continue
    if (placed.length) y += e.gap * p
    const h = e.height(t)
    placed.push({ e, y, h, p })
    y += h * p
  }
  return { placed, bottom: y }
}

export function hitTestRects(rects: HitRect[], x: number, y: number): string | null {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i]
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id
  }
  return null
}

/** Initials for monogram avatars. */
export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return ''
  const first = Array.from(parts[0])[0] ?? ''
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? '') : ''
  return (first + last).toLocaleUpperCase()
}
