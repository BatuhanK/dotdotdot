import { getImage, getVideo } from '../lib/assets'
import { CHAT_STRINGS } from '../lib/i18n'
import type { Timeline } from '../lib/timeline'
import type { Project } from '../lib/types'
import { DEVICES, type DeviceSpec } from './devices'
import { createIMessageScene } from './imessage'
import { createWhatsAppScene } from './whatsapp'
import type { ChatScene } from './scene'
import { drawCutout, drawHomeIndicator } from './statusbar'
import { drawCover, roundRectPath, type Ctx } from './util'

export interface FrameRenderer {
  width: number
  height: number
  /** Draw the frame at time t. `bg` overrides the background video frame (used when exporting). */
  draw(ctx: Ctx, t: number, bg?: CanvasImageSource | null): void
  /** Message id under an output-pixel position. */
  hitTest(px: number, py: number): string | null
}

export function outputSize(project: Project): { width: number; height: number } {
  return project.resolution === 720 ? { width: 720, height: 1280 } : { width: 1080, height: 1920 }
}

interface ScreenPlacement {
  x: number
  y: number
  scale: number
  w: number
  h: number
  radius: number
}

function makeScene(project: Project, timeline: Timeline, dev: DeviceSpec, w: number, h: number, scale: number): ChatScene {
  const input = { project, timeline, device: dev, width: w, height: h, scale, strings: CHAT_STRINGS[project.locale] }
  return project.app === 'whatsapp' ? createWhatsAppScene(input) : createIMessageScene(input)
}

export function createFrameRenderer(project: Project, timeline: Timeline): FrameRenderer {
  const { width: OW, height: OH } = outputSize(project)
  const dev = DEVICES[project.device]
  const layout = project.layout

  let place: ScreenPlacement
  let split = 0
  if (layout === 'mockup') {
    const frameExtra = dev.frame.bezel + dev.frame.band
    const chin = dev.cutout.kind === 'none' ? 64 : 0
    const totalH = dev.height + 2 * frameExtra + 2 * chin
    const totalW = dev.width + 2 * frameExtra
    const scale = Math.min((OH * 0.88) / totalH, (OW * 0.86) / totalW)
    const w = dev.width
    const h = dev.height
    place = { x: (OW - w * scale) / 2, y: (OH - h * scale) / 2, scale, w, h, radius: dev.radius }
  } else if (layout === 'split') {
    split = Math.round(OH * Math.min(0.8, Math.max(0.35, project.splitRatio)))
    const scale = OW / dev.width
    place = { x: 0, y: 0, scale, w: dev.width, h: split / scale, radius: 0 }
  } else {
    const scale = OW / dev.width
    place = { x: 0, y: 0, scale, w: dev.width, h: OH / scale, radius: 0 }
  }

  const scene = makeScene(project, timeline, dev, place.w, place.h, place.scale)
  const dark = project.appearance === 'dark'

  function drawBackground(c: Ctx, x: number, y: number, w: number, h: number, bgFrame: CanvasImageSource | null | undefined) {
    const bg = project.background
    c.save()
    c.beginPath()
    c.rect(x, y, w, h)
    c.clip()
    if (bg.kind === 'gradient') {
      const g = c.createLinearGradient(x, y, x + w * 0.4, y + h)
      g.addColorStop(0, bg.color)
      g.addColorStop(1, bg.color2)
      c.fillStyle = g
      c.fillRect(x, y, w, h)
    } else {
      c.fillStyle = bg.color
      c.fillRect(x, y, w, h)
    }
    if (bg.kind === 'image') {
      const img = getImage(bg.asset)
      if (img) drawCover(c, img, x, y, w, h)
    } else if (bg.kind === 'video') {
      const src = bgFrame ?? getVideo(bg.asset)
      if (src) {
        const vw = (src as HTMLVideoElement).videoWidth || (src as { width: number }).width
        const vh = (src as HTMLVideoElement).videoHeight || (src as { height: number }).height
        if (vw && vh) drawCover(c, src, x, y, w, h, vw, vh)
      }
    }
    if ((bg.kind === 'image' || bg.kind === 'video') && bg.dim > 0) {
      c.fillStyle = `rgba(0,0,0,${bg.dim})`
      c.fillRect(x, y, w, h)
    }
    c.restore()
  }

  function drawFrameBody(c: Ctx) {
    const s = place.scale
    const f = dev.frame
    const sx = place.x
    const sy = place.y
    const sw = place.w * s
    const sh = place.h * s
    const chin = dev.cutout.kind === 'none' ? 64 * s : 0
    const bez = f.bezel * s
    const band = f.band * s
    const r = dev.radius * s
    const ox = sx - bez - band
    const oy = sy - bez - band - chin
    const ow = sw + 2 * (bez + band)
    const oh = sh + 2 * (bez + band + chin)
    const orad = chin ? 58 * s : r + bez + band

    // shadow
    c.save()
    c.shadowColor = 'rgba(0,0,0,0.45)'
    c.shadowBlur = 60 * s
    c.shadowOffsetY = 24 * s
    c.fillStyle = f.color2
    roundRectPath(c, ox, oy, ow, oh, orad)
    c.fill()
    c.restore()

    // side buttons
    c.fillStyle = f.color2
    const btn = (x: number, y: number, h: number) => {
      roundRectPath(c, x, y, 3.2 * s, h, 1.6 * s)
      c.fill()
    }
    btn(ox - 2.2 * s, oy + oh * 0.2, oh * 0.045)
    btn(ox - 2.2 * s, oy + oh * 0.275, oh * 0.075)
    btn(ox - 2.2 * s, oy + oh * 0.365, oh * 0.075)
    btn(ox + ow - 1 * s, oy + oh * 0.29, oh * 0.11)

    // metal band
    const g = c.createLinearGradient(ox, 0, ox + ow, 0)
    g.addColorStop(0, f.color2)
    g.addColorStop(0.04, f.color)
    g.addColorStop(0.5, f.color)
    g.addColorStop(0.96, f.color)
    g.addColorStop(1, f.color2)
    c.fillStyle = g
    roundRectPath(c, ox, oy, ow, oh, orad)
    c.fill()
    c.strokeStyle = 'rgba(255,255,255,0.25)'
    c.lineWidth = 1 * s
    roundRectPath(c, ox + 0.5 * s, oy + 0.5 * s, ow - s, oh - s, orad)
    c.stroke()

    // bezel
    c.fillStyle = '#050505'
    roundRectPath(c, sx - bez, sy - bez - chin, sw + 2 * bez, sh + 2 * bez + 2 * chin, chin ? 52 * s : r + bez)
    c.fill()
    if (chin) {
      c.strokeStyle = '#2a2a2c'
      c.lineWidth = 2 * s
      c.beginPath()
      c.arc(sx + sw / 2, sy + sh + chin / 2 + bez / 2, 19 * s, 0, Math.PI * 2)
      c.stroke()
      c.fillStyle = '#1a1a1c'
      roundRectPath(c, sx + sw / 2 - 23 * s, sy - chin / 2 - 3 * s, 46 * s, 6 * s, 3 * s)
      c.fill()
    }
  }

  return {
    width: OW,
    height: OH,
    draw(c: Ctx, t: number, bgFrame?: CanvasImageSource | null) {
      c.save()
      if (layout === 'mockup') {
        drawBackground(c, 0, 0, OW, OH, bgFrame)
        drawFrameBody(c)
      } else if (layout === 'split') {
        drawBackground(c, 0, split, OW, OH - split, bgFrame)
      }

      // phone screen
      c.save()
      c.translate(place.x, place.y)
      c.scale(place.scale, place.scale)
      c.beginPath()
      if (place.radius) c.roundRect(0, 0, place.w, place.h, place.radius)
      else c.rect(0, 0, place.w, place.h)
      c.clip()
      scene.draw(c, t)
      if (layout === 'mockup' || project.status.showIsland) drawCutout(c, dev, place.w)
      if (layout === 'mockup' && dev.cutout.kind !== 'none' && !project.keyboard)
        drawHomeIndicator(c, place.w, place.h, dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)')
      c.restore()

      if (layout === 'split') {
        c.fillStyle = 'rgba(0,0,0,0.25)'
        c.fillRect(0, split - 1, OW, 2)
      }
      c.restore()
    },
    hitTest(px: number, py: number) {
      const x = (px - place.x) / place.scale
      const y = (py - place.y) / place.scale
      if (x < 0 || y < 0 || x > place.w || y > place.h) return null
      return scene.hitTest(x, y)
    },
  }
}
