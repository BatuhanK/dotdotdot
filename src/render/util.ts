export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Critically damped spring from 0 to 1 (no overshoot). `settle` ≈ time to 99%. */
export function springIn(t: number, settle = 0.42): number {
  if (t <= 0) return 0
  const w = 6.64 / settle
  return 1 - (1 + w * t) * Math.exp(-w * t)
}

/** Under-damped spring from 0 to 1 with a little overshoot. */
export function springBounce(t: number, freq = 2.6, damping = 0.62): number {
  if (t <= 0) return 0
  const w = 2 * Math.PI * freq
  const zeta = damping
  const wd = w * Math.sqrt(1 - zeta * zeta)
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t))
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3)
export const easeInOutCubic = (t: number) => {
  const x = clamp(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** Presence of something that appears at `inAt` and disappears at `outAt` (0..1). */
export function presence(t: number, inAt: number, outAt = Infinity, inDur = 0.42, outDur = 0.22): number {
  if (t < inAt) return 0
  const a = springIn(t - inAt, inDur)
  if (t < outAt) return a
  return a * (1 - easeOutCubic((t - outAt) / outDur))
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

export function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const c = (x: number, y: number) => Math.round(lerp(x, y, t))
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]): void {
  ctx.beginPath()
  const rr = Array.isArray(r) ? r.map((v) => Math.min(v, w / 2, h / 2)) : Math.min(r, w / 2, h / 2)
  ctx.roundRect(x, y, w, h, rr)
}

export function circlePath(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
}

/** Draw an image covering the rectangle (like CSS object-fit: cover). */
export function drawCover(ctx: Ctx, img: CanvasImageSource, x: number, y: number, w: number, h: number, srcW?: number, srcH?: number): void {
  const any = img as { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number; width?: unknown; height?: unknown }
  const iw = srcW ?? (any.videoWidth || any.naturalWidth || (typeof any.width === 'number' ? any.width : 0))
  const ih = srcH ?? (any.videoHeight || any.naturalHeight || (typeof any.height === 'number' ? any.height : 0))
  if (!iw || !ih) return
  const s = Math.max(w / iw, h / ih)
  const sw = w / s
  const sh = h / s
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h)
}

/** Smooth polyline through points (quadratic curves through midpoints). */
export function smoothPolyline(ctx: Ctx, pts: [number, number][], move = true): void {
  if (!pts.length) return
  if (move) ctx.moveTo(pts[0][0], pts[0][1])
  else ctx.lineTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i]
    const [nx, ny] = pts[i + 1]
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last[0], last[1])
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas
const blurCanvases: AnyCanvas[] = []

function scratch(i: number, w: number, h: number): AnyCanvas {
  let c = blurCanvases[i]
  if (!c) {
    c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h })
    blurCanvases[i] = c
  }
  if (c.width !== w || c.height !== h) {
    c.width = w
    c.height = h
  }
  return c
}

/**
 * iOS 26 style "scroll edge effect": blur whatever is already drawn in the rectangle, strongest at
 * the outer edge (`edge`) and fading to sharp towards the content. Works on the canvas pixels, so it
 * respects the current transform (mockup / split layouts).
 */
export function progressiveBlur(ctx: Ctx, x: number, y: number, w: number, h: number, edge: 'top' | 'bottom', factor = 14): void {
  const m = ctx.getTransform()
  const px = Math.round(m.a * x + m.e)
  const py = Math.round(m.d * y + m.f)
  const pw = Math.round(m.a * w)
  const ph = Math.round(m.d * h)
  if (pw < 8 || ph < 8) return
  const w1 = Math.max(1, Math.round(pw / 4))
  const h1 = Math.max(1, Math.round(ph / 4))
  const w2 = Math.max(1, Math.round(pw / factor))
  const h2 = Math.max(1, Math.round(ph / factor))
  const a = scratch(0, w1, h1)
  const b = scratch(1, w2, h2)
  const full = scratch(2, pw, ph)
  const ac = a.getContext('2d') as Ctx
  const bc = b.getContext('2d') as Ctx
  const fc = full.getContext('2d') as Ctx
  ac.imageSmoothingQuality = 'high'
  bc.imageSmoothingQuality = 'high'
  fc.imageSmoothingQuality = 'high'
  ac.clearRect(0, 0, w1, h1)
  ac.drawImage(ctx.canvas as CanvasImageSource, px, py, pw, ph, 0, 0, w1, h1)
  bc.clearRect(0, 0, w2, h2)
  bc.drawImage(a, 0, 0, w1, h1, 0, 0, w2, h2)
  ac.clearRect(0, 0, w1, h1)
  ac.drawImage(b, 0, 0, w2, h2, 0, 0, w1, h1)
  fc.globalCompositeOperation = 'source-over'
  fc.clearRect(0, 0, pw, ph)
  fc.drawImage(a, 0, 0, w1, h1, 0, 0, pw, ph)
  fc.globalCompositeOperation = 'destination-in'
  const g = fc.createLinearGradient(0, 0, 0, ph)
  if (edge === 'top') {
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(0.5, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
  } else {
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.5, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,1)')
  }
  fc.fillStyle = g
  fc.fillRect(0, 0, pw, ph)
  fc.globalCompositeOperation = 'source-over'
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(full, px, py)
  ctx.restore()
}

/** Evenly blur what is already drawn in the rectangle (frosted bars). Respects the current transform. */
export function blurRegion(ctx: Ctx, x: number, y: number, w: number, h: number, factor = 12): void {
  const m = ctx.getTransform()
  const px = Math.round(m.a * x + m.e)
  const py = Math.round(m.d * y + m.f)
  const pw = Math.round(m.a * w)
  const ph = Math.round(m.d * h)
  if (pw < 8 || ph < 8) return
  const w1 = Math.max(1, Math.round(pw / 4))
  const h1 = Math.max(1, Math.round(ph / 4))
  const w2 = Math.max(1, Math.round(pw / factor))
  const h2 = Math.max(1, Math.round(ph / factor))
  const a = scratch(3, w1, h1)
  const b = scratch(4, w2, h2)
  const ac = a.getContext('2d') as Ctx
  const bc = b.getContext('2d') as Ctx
  ac.imageSmoothingQuality = 'high'
  bc.imageSmoothingQuality = 'high'
  ac.clearRect(0, 0, w1, h1)
  ac.drawImage(ctx.canvas as CanvasImageSource, px, py, pw, ph, 0, 0, w1, h1)
  bc.clearRect(0, 0, w2, h2)
  bc.drawImage(a, 0, 0, w1, h1, 0, 0, w2, h2)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(b, 0, 0, w2, h2, px, py, pw, ph)
  ctx.restore()
}
