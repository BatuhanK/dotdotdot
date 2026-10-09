import { createFrameRenderer } from '../render/compose'
import { preloadEmoji } from '../render/emoji'
import { loadFonts } from '../render/fonts'
import { roundRectPath } from '../render/util'
import { loadAssets } from './assets'
import type { Timeline } from './timeline'
import type { Project } from './types'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

async function prepare(project: Project, timeline: Timeline) {
  await loadFonts()
  await loadAssets([
    project.chat.avatar,
    project.background.asset,
    ...timeline.participants.map((p) => p.avatar),
    ...timeline.items.map((i) => i.msg.image ?? null),
  ])
  await preloadEmoji(timeline.items.map((i) => i.msg.text ?? ''))
}

/** Last frame of the chat (full screen layout) drawn into a canvas. */
async function endFrame(project: Project, timeline: Timeline): Promise<HTMLCanvasElement> {
  await prepare(project, timeline)
  const p: Project = { ...project, layout: 'fullscreen', resolution: 720 }
  const r = createFrameRenderer(p, timeline)
  const c = document.createElement('canvas')
  c.width = r.width
  c.height = r.height
  r.draw(c.getContext('2d')!, Math.max(0, timeline.duration - 0.25))
  return c
}

/** Small JPEG for project cards. */
export async function renderThumb(project: Project, timeline: Timeline, width = 180): Promise<string> {
  const frame = await endFrame(project, timeline)
  const c = document.createElement('canvas')
  c.width = width
  c.height = Math.round((width * frame.height) / frame.width)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(frame, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}

/** 1200×630 link-preview card: the chat on a warm background with the title. */
export async function renderOgImage(project: Project, timeline: Timeline, title: string): Promise<Blob> {
  const frame = await endFrame(project, timeline)
  const W = 1200
  const H = 630
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#FFF6DA')
  g.addColorStop(1, '#FFE3A3')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Phone screen, top part of the last frame.
  const pw = 330
  const ph = 590
  const px = W - pw - 90
  const py = 40
  ctx.save()
  ctx.shadowColor = 'rgba(80,50,0,0.28)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 14
  ctx.fillStyle = '#111'
  roundRectPath(ctx, px - 10, py - 10, pw + 20, ph + 40, 58)
  ctx.fill()
  ctx.restore()
  ctx.save()
  roundRectPath(ctx, px, py, pw, ph + 20, 50)
  ctx.clip()
  const s = pw / frame.width
  ctx.drawImage(frame, px, py, pw, frame.height * s)
  ctx.restore()

  const font = (weight: number, size: number) => `${weight} ${size}px "SF Pro Rounded", "SF Pro Display", -apple-system, sans-serif`
  await Promise.all([document.fonts.load(font(800, 64)), document.fonts.load(font(700, 30))]).catch(() => undefined)

  // Brand: the icon and the "dotdotdot" wordmark with its fading dots.
  const icon = await loadImage('/favicon.svg').catch(() => null)
  if (icon) ctx.drawImage(icon, 80, 66, 60, 60)
  ctx.font = font(800, 38)
  let x = icon ? 154 : 80
  ;[1, 0.6, 0.35].forEach((alpha) => {
    ctx.fillStyle = `rgba(26,18,0,${alpha})`
    ctx.fillText('dot', x, 110)
    x += ctx.measureText('dot').width
  })

  ctx.fillStyle = '#1A1200'
  ctx.font = font(800, 64)
  const words = (title || 'A chat story').split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (ctx.measureText(next).width > 560 && cur) {
      lines.push(cur)
      cur = w
    } else cur = next
  }
  if (cur) lines.push(cur)
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, 80, 250 + i * 74))

  // "Watch the story" pill
  const py2 = 250 + Math.min(3, lines.length) * 74 + 10
  ctx.font = font(700, 30)
  const label = '▶  Watch the story'
  const lw = ctx.measureText(label).width
  ctx.fillStyle = '#FFB800'
  roundRectPath(ctx, 80, py2, lw + 56, 64, 32)
  ctx.fill()
  ctx.fillStyle = '#1A1200'
  ctx.fillText(label, 108, py2 + 43)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('image failed'))), 'image/jpeg', 0.86))
}
