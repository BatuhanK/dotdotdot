import { drawText } from './text'
import { clamp, roundRectPath, type Ctx } from './util'

/*
 * iOS 26 system keyboard. Geometry measured on a 402pt-wide iPhone 17 Pro:
 * keyboard panel 317.5pt tall, keys 45pt tall on a 56pt row pitch, 6pt gaps, 8.67pt side margins.
 */
export const KEYBOARD_HEIGHT = 317.5

const ROWS_EN = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const ROWS_TR = ['qwertyuıopğü', 'asdfghjklşi', 'zxcvbnmöç']

export interface KeyPress {
  at: number
  kind: 'char' | 'delete'
  char: string
}

interface KeyRect {
  label: string
  x: number
  y: number
  w: number
  h: number
}

const MARGIN = 8.67
const GAP = 6
const KEY_H = 45
const ROW_Y = [24.5, 80.5, 136.5, 192.5]

function letterRows(locale: string): string[] {
  return locale === 'tr' ? ROWS_TR : ROWS_EN
}

export function layoutKeys(width: number, locale: string): { letters: KeyRect[]; shift: KeyRect; del: KeyRect } {
  const rows = letterRows(locale)
  const keyW = (width - 2 * MARGIN - (rows[0].length - 1) * GAP) / rows[0].length
  const letters: KeyRect[] = []
  rows.forEach((row, r) => {
    const total = row.length * keyW + (row.length - 1) * GAP
    const x0 = (width - total) / 2
    Array.from(row).forEach((ch, i) => letters.push({ label: ch, x: x0 + i * (keyW + GAP), y: ROW_Y[r], w: keyW, h: KEY_H }))
  })
  const r3 = rows[2]
  const r3Total = r3.length * keyW + (r3.length - 1) * GAP
  const r3x0 = (width - r3Total) / 2
  const sideW = Math.min(45, r3x0 - MARGIN - (r3x0 - MARGIN > 50 ? 13.7 : 7))
  const shift = { label: 'shift', x: MARGIN, y: ROW_Y[2], w: sideW, h: KEY_H }
  const del = { label: 'delete', x: width - MARGIN - sideW, y: ROW_Y[2], w: sideW, h: KEY_H }
  return { letters, shift, del }
}

function lower(ch: string, locale: string): string {
  return locale === 'tr' ? ch.toLocaleLowerCase('tr') : ch.toLowerCase()
}

export interface KeyboardColors {
  panel: string
  key: string
  special: string
  label: string
  popup: string
  pressed: string
}

export const KB_LIGHT: KeyboardColors = {
  panel: '#E2E4E7',
  key: '#FFFFFF',
  special: '#FFFFFF',
  label: '#000000',
  popup: '#FFFFFF',
  pressed: '#C9CCD2',
}

export const KB_DARK: KeyboardColors = {
  panel: '#1E1E20',
  key: '#58585C',
  special: '#3F3F42',
  label: '#FFFFFF',
  popup: '#6A6A6E',
  pressed: '#808084',
}

function drawShiftIcon(ctx: Ctx, cx: number, cy: number, color: string, filled: boolean) {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx, cy - 8.5)
  ctx.lineTo(cx + 9.5, cy + 1.2)
  ctx.lineTo(cx + 4.6, cy + 1.2)
  ctx.lineTo(cx + 4.6, cy + 8.3)
  ctx.lineTo(cx - 4.6, cy + 8.3)
  ctx.lineTo(cx - 4.6, cy + 1.2)
  ctx.lineTo(cx - 9.5, cy + 1.2)
  ctx.closePath()
  ctx.lineJoin = 'round'
  ctx.lineWidth = 1.6
  ctx.strokeStyle = color
  ctx.fillStyle = color
  if (filled) ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawDeleteIcon(ctx: Ctx, cx: number, cy: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const w = 20
  const h = 15.5
  const x = cx - w / 2 + 1.5
  ctx.beginPath()
  ctx.moveTo(x - 5.5, cy)
  ctx.lineTo(x + 1.5, cy - h / 2)
  ctx.lineTo(x + w - 2.5, cy - h / 2)
  ctx.quadraticCurveTo(x + w, cy - h / 2, x + w, cy - h / 2 + 2.5)
  ctx.lineTo(x + w, cy + h / 2 - 2.5)
  ctx.quadraticCurveTo(x + w, cy + h / 2, x + w - 2.5, cy + h / 2)
  ctx.lineTo(x + 1.5, cy + h / 2)
  ctx.closePath()
  ctx.stroke()
  const ix = x + 8.7
  ctx.beginPath()
  ctx.moveTo(ix - 3.2, cy - 3.2)
  ctx.lineTo(ix + 3.2, cy + 3.2)
  ctx.moveTo(ix + 3.2, cy - 3.2)
  ctx.lineTo(ix - 3.2, cy + 3.2)
  ctx.stroke()
  ctx.restore()
}

function drawReturnIcon(ctx: Ctx, cx: number, cy: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx + 9, cy - 7.5)
  ctx.lineTo(cx + 9, cy - 1)
  ctx.quadraticCurveTo(cx + 9, cy + 2.6, cx + 5.4, cy + 2.6)
  ctx.lineTo(cx - 9, cy + 2.6)
  ctx.moveTo(cx - 4.5, cy - 2)
  ctx.lineTo(cx - 9.2, cy + 2.6)
  ctx.lineTo(cx - 4.5, cy + 7.2)
  ctx.stroke()
  ctx.restore()
}

function drawSmiley(ctx: Ctx, cx: number, cy: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(cx, cy, 9, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx - 3.2, cy - 2.6, 1.15, 1.7, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + 3.2, cy - 2.6, 1.15, 1.7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx - 5.2, cy + 1.4)
  ctx.quadraticCurveTo(cx, cy + 9.4, cx + 5.2, cy + 1.4)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawGlobe(ctx: Ctx, cx: number, cy: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.7
  ctx.beginPath()
  ctx.arc(cx, cy, 12.6, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx, cy, 5.6, 12.6, 0, 0, Math.PI * 2)
  ctx.moveTo(cx, cy - 12.6)
  ctx.lineTo(cx, cy + 12.6)
  ctx.moveTo(cx - 12.6, cy)
  ctx.lineTo(cx + 12.6, cy)
  ctx.moveTo(cx - 10.8, cy - 6.3)
  ctx.lineTo(cx + 10.8, cy - 6.3)
  ctx.moveTo(cx - 10.8, cy + 6.3)
  ctx.lineTo(cx + 10.8, cy + 6.3)
  ctx.stroke()
  ctx.restore()
}

export function drawMicGlyph(ctx: Ctx, cx: number, cy: number, h: number, color: string, lw = 1.6) {
  const s = h / 28
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  roundRectPath(ctx, cx - 4.6 * s, cy - 13.4 * s, 9.2 * s, 17.4 * s, 4.6 * s)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - 8.4 * s, cy - 1.6 * s)
  ctx.quadraticCurveTo(cx - 8.4 * s, cy + 8.2 * s, cx, cy + 8.2 * s)
  ctx.quadraticCurveTo(cx + 8.4 * s, cy + 8.2 * s, cx + 8.4 * s, cy - 1.6 * s)
  ctx.moveTo(cx, cy + 8.2 * s)
  ctx.lineTo(cx, cy + 13.6 * s)
  ctx.moveTo(cx - 4.8 * s, cy + 13.6 * s)
  ctx.lineTo(cx + 4.8 * s, cy + 13.6 * s)
  ctx.stroke()
  ctx.restore()
}

/**
 * Draw the keyboard with its top edge at `top`. `presses` are typed characters; the ones pressed
 * within the last ~0.12s show the iOS key preview balloon.
 */
export function drawKeyboard(
  ctx: Ctx,
  width: number,
  top: number,
  height: number,
  colors: KeyboardColors,
  locale: string,
  t: number,
  presses: KeyPress[],
  upperNext: boolean,
): void {
  ctx.save()
  ctx.fillStyle = colors.panel
  roundRectPath(ctx, 0, top, width, height + 40, [27, 27, 0, 0])
  ctx.fill()

  const { letters, shift, del } = layoutKeys(width, locale)
  const radius = 8.5

  // Currently pressed key (most recent press within 120ms).
  let active: KeyPress | null = null
  for (let i = presses.length - 1; i >= 0; i--) {
    const p = presses[i]
    if (p.at <= t) {
      if (t - p.at < 0.12) active = p
      break
    }
  }
  const activeChar = active && active.kind === 'char' ? lower(active.char, locale) : null
  const spacePressed = active?.kind === 'char' && active.char === ' '
  const deletePressed = active?.kind === 'delete'

  const key = (r: KeyRect, fill: string) => {
    ctx.fillStyle = fill
    roundRectPath(ctx, r.x, top + r.y, r.w, r.h, radius)
    ctx.fill()
  }

  let popup: KeyRect | null = null
  for (const k of letters) {
    const pressed = activeChar === k.label
    if (pressed) popup = k
    key(k, colors.key)
    const label = upperNext ? (locale === 'tr' ? k.label.toLocaleUpperCase('tr') : k.label.toUpperCase()) : k.label
    drawText(ctx, label, { size: 22, weight: 400, noTracking: true }, k.x + k.w / 2, top + k.y + 29.2, colors.label, 'center')
  }

  key(shift, colors.special)
  drawShiftIcon(ctx, shift.x + shift.w / 2, top + shift.y + 22.5, colors.label, upperNext)
  key(del, deletePressed ? colors.pressed : colors.special)
  drawDeleteIcon(ctx, del.x + del.w / 2, top + del.y + 22.5, colors.label)

  // Bottom row: 123, emoji, space, return.
  const y4 = top + ROW_Y[3]
  const w123 = 42.67
  const wEmoji = 43
  const wReturn = (92 / 402) * width
  const xSpace = MARGIN + w123 + GAP + wEmoji + GAP
  const wSpace = width - MARGIN - wReturn - GAP - xSpace
  key({ label: '123', x: MARGIN, y: ROW_Y[3], w: w123, h: KEY_H }, colors.special)
  drawText(ctx, '123', { size: 16.5, weight: 400 }, MARGIN + w123 / 2, y4 + 28.4, colors.label, 'center')
  key({ label: 'emoji', x: MARGIN + w123 + GAP, y: ROW_Y[3], w: wEmoji, h: KEY_H }, colors.special)
  drawSmiley(ctx, MARGIN + w123 + GAP + wEmoji / 2, y4 + 22.5, colors.label)
  key({ label: 'space', x: xSpace, y: ROW_Y[3], w: wSpace, h: KEY_H }, spacePressed ? colors.pressed : colors.key)
  key({ label: 'return', x: width - MARGIN - wReturn, y: ROW_Y[3], w: wReturn, h: KEY_H }, colors.special)
  drawReturnIcon(ctx, width - MARGIN - wReturn / 2, y4 + 22.5, colors.label)

  // Globe + dictation under the keys.
  drawGlobe(ctx, 42.5, top + 277.5, colors.label)
  drawMicGlyph(ctx, width - 42.67, top + 276.5, 28, colors.label, 1.7)

  // Key preview balloon.
  if (popup && active) {
    const age = clamp((t - active.at) / 0.03)
    const k = popup
    const pw = k.w + 22
    const ph = 56
    const px = clamp(k.x + k.w / 2 - pw / 2, 2, width - pw - 2)
    const py = top + k.y - ph + 8
    ctx.save()
    ctx.globalAlpha = age
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 1
    ctx.fillStyle = colors.popup
    ctx.beginPath()
    ctx.roundRect(px, py, pw, ph, 12)
    ctx.roundRect(k.x, top + k.y + 6, k.w, k.h - 6, [0, 0, radius, radius])
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillRect(k.x, top + k.y, k.w, 14)
    const label = upperNext || /\p{Lu}/u.test(active.char) ? active.char : k.label
    drawText(ctx, label, { size: 34, weight: 400 }, px + pw / 2, py + 40, colors.label, 'center')
    ctx.restore()
  }
  ctx.restore()
}
