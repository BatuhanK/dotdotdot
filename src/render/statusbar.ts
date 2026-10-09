import type { StatusBar } from '../lib/types'
import type { DeviceSpec } from './devices'
import { drawText } from './text'
import { roundRectPath, type Ctx } from './util'

/*
 * iOS 26 status bar. Geometry measured from a 3x iPhone 17 Pro screenshot:
 * time centred at x=73.67, icons ending at x=366.67, everything centred on y=32.67.
 */
export function drawStatusBar(ctx: Ctx, dev: DeviceSpec, s: StatusBar, color: string, width: number): void {
  if (dev.cutout.kind === 'none') return drawCompactStatusBar(ctx, s, color, width)
  const st = dev.status
  const cy = st.centerY
  const R = st.iconsRight + (width - dev.width)

  // Time
  drawText(ctx, s.time, { size: 17, weight: 600 }, st.timeX, cy + 6.05, color, 'center')

  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color

  // Cellular bars
  const bars = [4.67, 7, 9.67, 12.33]
  const barsLeft = R - 78.34
  bars.forEach((h, i) => {
    ctx.globalAlpha = i < s.signal ? 1 : 0.28
    roundRectPath(ctx, barsLeft + i * 5.33, cy + 6 - h, 3.33, h, 1.1)
    ctx.fill()
  })
  ctx.globalAlpha = 1

  // Wi-Fi
  if (s.wifi) {
    const wx = R - 43.17
    const wy = cy + 6.0
    const a0 = -Math.PI / 2 - 0.775
    const a1 = -Math.PI / 2 + 0.775
    ctx.lineCap = 'round'
    for (const [rIn, rOut] of [
      [9.83, 12.33],
      [5.67, 8.0],
    ]) {
      const r = (rIn + rOut) / 2
      ctx.lineWidth = rOut - rIn
      const pad = (ctx.lineWidth / 2 / r) * 0.9
      ctx.beginPath()
      ctx.arc(wx, wy, r, a0 + pad, a1 - pad)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(wx, wy - 0.15)
    ctx.arc(wx, wy, 3.75, a0 + 0.05, a1 - 0.05)
    ctx.closePath()
    ctx.lineJoin = 'round'
    ctx.lineWidth = 0.8
    ctx.fill()
    ctx.stroke()
  }

  // Battery
  const bx = R - 27.27
  const by = cy - 6.67
  ctx.globalAlpha = 0.36
  ctx.lineWidth = 1
  roundRectPath(ctx, bx + 0.5, by + 0.5, 23.6, 12, 4.1)
  ctx.stroke()
  roundRectPath(ctx, R - 1.67, cy - 2, 1.4, 4, [0, 1, 1, 0])
  ctx.fill()
  ctx.globalAlpha = 1
  const level = Math.max(0, Math.min(100, s.battery))
  const fillW = Math.max(level > 0 ? 2.5 : 0, (21 * level) / 100)
  ctx.fillStyle = s.charging ? '#34C759' : level <= 20 ? '#FF3B30' : color
  if (fillW > 0) {
    roundRectPath(ctx, bx + 1.94, by + 2, fillW, 9, 2.4)
    ctx.fill()
  }
  if (s.charging) {
    ctx.fillStyle = color
    ctx.beginPath()
    const cx = bx + 12.3
    ctx.moveTo(cx + 1.2, cy - 5.2)
    ctx.lineTo(cx - 3.2, cy + 0.8)
    ctx.lineTo(cx - 0.2, cy + 0.8)
    ctx.lineTo(cx - 1.2, cy + 5.2)
    ctx.lineTo(cx + 3.2, cy - 0.8)
    ctx.lineTo(cx + 0.2, cy - 0.8)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

export function drawCutout(ctx: Ctx, dev: DeviceSpec, width: number): void {
  const c = dev.cutout
  if (c.kind === 'none') return
  ctx.save()
  ctx.fillStyle = '#000'
  const x = (width - c.w) / 2
  if (c.kind === 'island') {
    roundRectPath(ctx, x, c.y, c.w, c.h, c.h / 2)
    ctx.fill()
  } else {
    // Notch: flat top, rounded bottom corners, with small outer fillets.
    const r = 20
    ctx.beginPath()
    ctx.moveTo(x - 6, 0)
    ctx.quadraticCurveTo(x, 0, x, 6)
    ctx.lineTo(x, c.h - r)
    ctx.quadraticCurveTo(x, c.h, x + r, c.h)
    ctx.lineTo(x + c.w - r, c.h)
    ctx.quadraticCurveTo(x + c.w, c.h, x + c.w, c.h - r)
    ctx.lineTo(x + c.w, 6)
    ctx.quadraticCurveTo(x + c.w, 0, x + c.w + 6, 0)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

export function drawHomeIndicator(ctx: Ctx, width: number, height: number, color: string): void {
  ctx.save()
  ctx.fillStyle = color
  roundRectPath(ctx, (width - 139) / 2, height - 8 - 5, 139, 5, 2.5)
  ctx.fill()
  ctx.restore()
}

/** Home-button iPhones: 20pt bar, signal + Wi-Fi left, 12pt time centred, battery right. */
function drawCompactStatusBar(ctx: Ctx, s: StatusBar, color: string, width: number): void {
  const cy = 10
  drawText(ctx, s.time, { size: 12, weight: 600 }, width / 2, cy + 4.3, color, 'center')
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  const bars = [3.3, 5, 7, 9]
  bars.forEach((h, i) => {
    ctx.globalAlpha = i < s.signal ? 1 : 0.28
    roundRectPath(ctx, 6 + i * 4.2, cy + 4.5 - h, 3, h, 0.8)
    ctx.fill()
  })
  ctx.globalAlpha = 1
  if (s.wifi) {
    const wx = 30.5
    const wy = cy + 4.6
    const a0 = -Math.PI / 2 - 0.775
    const a1 = -Math.PI / 2 + 0.775
    ctx.lineCap = 'round'
    for (const [rIn, rOut] of [
      [7.1, 8.9],
      [4.1, 5.8],
    ]) {
      const r = (rIn + rOut) / 2
      ctx.lineWidth = rOut - rIn
      ctx.beginPath()
      ctx.arc(wx, wy, r, a0 + 0.12, a1 - 0.12)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(wx, wy)
    ctx.arc(wx, wy, 2.7, a0, a1)
    ctx.closePath()
    ctx.fill()
  }
  const label = `${Math.round(s.battery)}%`
  const bw = 22
  const bx = width - 6 - 2 - bw
  drawText(ctx, label, { size: 12, weight: 600 }, bx - 3.5, cy + 4.3, color, 'right')
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 1
  roundRectPath(ctx, bx + 0.5, cy - 5, bw, 10.5, 2.6)
  ctx.stroke()
  roundRectPath(ctx, bx + bw + 1.2, cy - 1.8, 1.4, 4, [0, 1, 1, 0])
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = s.charging ? '#34C759' : s.battery <= 20 ? '#FF3B30' : color
  roundRectPath(ctx, bx + 2, cy - 3.5, Math.max(2, ((bw - 3) * s.battery) / 100), 7.5, 1.4)
  ctx.fill()
  ctx.restore()
}
