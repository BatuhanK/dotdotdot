import { getImage } from '../lib/assets'
import { dayLabel } from '../lib/datetime'
import { formatClock } from '../lib/i18n'
import type { TimedItem } from '../lib/timeline'
import { drawEmoji } from './emoji'
import { drawKeyboard, KB_DARK, KB_LIGHT, KEYBOARD_HEIGHT } from './keyboard'
import { hitTestRects, layoutEntries, type ChatScene, type Entry, type HitRect, type SceneInput } from './scene'
import { drawStatusBar } from './statusbar'
import { drawText, drawTextLayout, ellipsize, layoutText, measureText, type TextLayout } from './text'
import { blurRegion, circlePath, clamp, drawCover, easeInOutCubic, easeOutCubic, lerp, roundRectPath, springBounce, springIn, type Ctx } from './util'
import { waWallpaper } from './wa-assets'
import { WA_ICONS, type Icon } from './wa-icons'

/*
 * WhatsApp for iOS (2025 design) conversation screen.
 * Sizes, fonts and colours come from the "WhatsApp Screens 2025 – UI for iOS" Figma file (393×852 frames,
 * read through the Figma API) and from measuring its 3x exports. Points throughout.
 */
const WA = {
  margin: 16,
  padX: 10,
  lineH: 21,
  /** One line with the time on the same line. */
  minH: 33,
  /** Baseline of the first text line, from the bubble top. */
  baseline: 21.4,
  /** Extra height when the time has to go under the text. */
  timeRowH: 17,
  radius: 12,
  /** Text column of the widest bubble (287pt). */
  maxText: 267,
  gapSame: 3.33,
  gapOther: 12,
  avatar: 28,
  groupX: 44,
  nameH: 17,
  nameBaseline: 18,
  dateH: 44,
  reactionH: 24.5,
  reactionOverlap: 4,
  barH: 43,
  fieldLineH: 21,
}

const BODY = { size: 15.8, weight: 400, letterSpacing: -0.2054, noTracking: true, family: 'SF Pro Text' }
/** Emoji inside messages are drawn about the size of the text (measured on the reference). */
const EMOJI = 16
const TIME = { size: 11, weight: 400, letterSpacing: 0.55, noTracking: true, family: 'SF Pro Text' }
const NAME = { size: 14, weight: 600, letterSpacing: -0.07, noTracking: true, family: 'SF Pro Text' }
const CHIP = { size: 12, weight: 600, noTracking: true, family: 'SF Pro Text' }
const SYSTEM = { size: 12, weight: 400, noTracking: true, family: 'SF Pro Text' }
const TITLE = { size: 16, weight: 600, letterSpacing: -0.32, noTracking: true, family: 'SF Pro Text' }
const SUBTITLE = { size: 12, weight: 400, letterSpacing: -0.12, noTracking: true, family: 'SF Pro Text' }
const UNREAD = { size: 16.8, weight: 500, letterSpacing: -0.336, noTracking: true, family: 'SF Pro Text' }
const INPUT = { size: 16, weight: 400, noTracking: true, family: 'SF Pro Text' }
const COUNT = { size: 14, weight: 400, letterSpacing: -0.14, noTracking: true, family: 'SF Pro Text' }

/** Group sender name colours (the first three are from the reference). */
const NAME_COLORS = ['#7F66FF', '#FA6533', '#A46918', '#1FA855', '#D42A66', '#027EB5', '#C4532D', '#5E47DE', '#DC52C4', '#06A1A1']

interface Palette {
  incoming: string
  outgoing: string
  text: string
  bubbleEdge: string
  time: string
  tick: string
  read: string
  bar: string
  ink: string
  sub: string
  field: string
  fieldEdge: string
  chip: string
  chipText: string
  system: string
  dots: string
  send: string
  reaction: string
  reactionEdge: string
  paper: string
}

const LIGHT: Palette = {
  incoming: '#FFFFFF',
  outgoing: '#D0FECF',
  text: '#0A0A0A',
  bubbleEdge: 'rgba(0,0,0,0.06)',
  time: 'rgba(0,0,0,0.5)',
  tick: '#767779',
  read: '#007BFC',
  bar: 'rgba(245,242,235,0.8)',
  ink: '#0A0A0A',
  sub: 'rgba(0,0,0,0.5)',
  field: '#FFFFFF',
  fieldEdge: '#B2B2B2',
  chip: '#FFFFFF',
  chipText: '#0A0A0A',
  system: 'rgba(0,0,0,0.55)',
  dots: '#767779',
  send: '#1DAB61',
  reaction: '#FFFFFF',
  reactionEdge: '#F0E9DF',
  paper: '#F5F2EB',
}

// Dark mode isn't in the reference file: WhatsApp's dark palette, to be checked against a device.
const DARK: Palette = {
  incoming: '#242626',
  outgoing: '#144D37',
  text: '#E9EDEF',
  bubbleEdge: 'rgba(0,0,0,0)',
  time: 'rgba(233,237,239,0.6)',
  tick: '#8696A0',
  read: '#53BDEB',
  bar: 'rgba(22,22,22,0.85)',
  ink: '#F5F5F5',
  sub: 'rgba(233,237,239,0.6)',
  field: '#262829',
  fieldEdge: 'rgba(255,255,255,0.08)',
  chip: '#1D1F1F',
  chipText: '#E9EDEF',
  system: 'rgba(233,237,239,0.7)',
  dots: '#8696A0',
  send: '#21C063',
  reaction: '#242626',
  reactionEdge: '#0B141A',
  paper: '#0B141A',
}

/** Tail shapes (15×19 boxes) from the Figma "Tail" component. Me: bottom-right, friend: bottom-left. */
const TAIL_ME =
  'M7.5 4L7.5 0H0V14C3.65938 17.2528 10.6252 17.8604 13.1 17.9739C13.4071 17.988 13.5646 17.6021 13.3479 17.3841C11.7002 15.727 7.5 10.8328 7.5 4Z'
const TAIL_FRIEND =
  'M7.5 4L7.5 0H15V14C11.3406 17.2528 4.37479 17.8604 1.90001 17.9739C1.59291 17.988 1.43536 17.6021 1.65211 17.3841C3.2998 15.727 7.5 10.8328 7.5 4Z'

const pathCache = new Map<string, Path2D>()
function path2d(d: string): Path2D {
  let p = pathCache.get(d)
  if (!p) pathCache.set(d, (p = new Path2D(d)))
  return p
}

function drawIcon(c: Ctx, icon: Icon, x: number, y: number, color: string, size = icon.w) {
  const s = size / icon.w
  c.save()
  c.translate(x, y)
  c.scale(s, s)
  for (const p of icon.paths) {
    const path = path2d(p.d)
    if (p.stroke) {
      c.strokeStyle = color
      c.lineWidth = p.stroke
      c.lineCap = 'round'
      c.lineJoin = 'round'
      c.stroke(path)
    } else {
      c.fillStyle = color
      c.fill(path, p.evenodd ? 'evenodd' : 'nonzero')
    }
  }
  c.restore()
}

interface BubbleLayout {
  text: TextLayout | null
  w: number
  h: number
  /** The time sits on its own row under the text. */
  timeBelow: boolean
}

export function createWhatsAppScene(input: SceneInput): ChatScene {
  const { project, timeline, device: dev, width: W, height: H, scale, strings } = input
  const dark = project.appearance === 'dark'
  const P = dark ? DARK : LIGHT
  const kbColors = dark ? KB_DARK : KB_LIGHT
  const items = timeline.items
  const others = timeline.participants.filter((p) => !p.isMe)
  const isGroup = others.length > 1 || project.chat.group
  const bubbleLeft = isGroup ? WA.groupX : WA.margin
  const kbMode = project.keyboard
  const locale = project.locale
  const nameColor = new Map(others.map((p, i) => [p.id, NAME_COLORS[i % NAME_COLORS.length]]))
  const clockOf = (it: TimedItem) => formatClock(it.clock, project.clock24)

  // ---------- layouts ----------
  const layouts = new Map<number, BubbleLayout>()
  for (const it of items) {
    if (it.kind !== 'text') continue
    const mine = it.side === 'me'
    const tl = { ...layoutText(it.msg.text || ' ', BODY, WA.maxText, EMOJI), emojiDy: -0.2 }
    const lines = Math.max(1, tl.lines.length)
    const last = tl.lines[tl.lines.length - 1]?.width ?? 0
    const timeW = measureText(clockOf(it), TIME)
    // The time (and my ticks) go at the end of the last line when they fit, else on a row of their own.
    const block = mine ? timeW + 16 : timeW + 1.1
    const side = mine ? timeW + 29 : timeW + 12
    const inline = last + block + 6 <= WA.maxText
    const content = inline ? Math.min(WA.maxText, Math.max(tl.width, last + side)) : Math.max(tl.width, block)
    layouts.set(it.index, {
      text: tl,
      w: Math.ceil((content + 2 * WA.padX) * 3) / 3,
      h: WA.minH + (lines - 1) * WA.lineH + (inline ? 0 : WA.timeRowH),
      timeBelow: !inline,
    })
  }

  function imageSize(it: TimedItem): { w: number; h: number } {
    const img = getImage(it.msg.image)
    const maxW = 242
    if (!img) return { w: maxW + 6, h: Math.round(maxW * 0.75) + 6 }
    const ar = img.naturalWidth / img.naturalHeight
    let w = maxW
    let h = w / ar
    if (h > 320) {
      h = 320
      w = Math.max(140, h * ar)
    }
    return { w: Math.round(w) + 6, h: Math.round(Math.max(120, h)) + 6 }
  }

  // Runs of messages from the same sender: the name sits on the first, the tail and avatar on the last.
  const nextSame = new Map<number, TimedItem | null>()
  const prevSame = new Map<number, TimedItem | null>()
  const bubbles = items.filter((it) => it.kind === 'text' || it.kind === 'image')
  const isBreak = (a: TimedItem | undefined, b: TimedItem) => !a || items.slice(a.index + 1, b.index).some((x) => x.kind === 'timestamp' || x.kind === 'system')
  for (let i = 0; i < bubbles.length; i++) {
    const it = bubbles[i]
    const n = bubbles[i + 1]
    const p = bubbles[i - 1]
    nextSame.set(it.index, n && n.from?.id === it.from?.id && !isBreak(it, n) ? n : null)
    prevSame.set(it.index, p && p.from?.id === it.from?.id && !isBreak(p, it) ? p : null)
  }

  // ---------- drawing helpers ----------
  function bubbleShape(c: Ctx, x: number, y: number, w: number, h: number, mine: boolean, tail: boolean, fill: string) {
    const body = new Path2D()
    body.roundRect(x, y, w, h, WA.radius)
    const tailPath = tail ? path2d(mine ? TAIL_ME : TAIL_FRIEND) : null
    const tx = mine ? x + w - 7.5 : x - 7.5
    const ty = y + h - 18
    // 0.66pt hairline outside the shape: stroke first, then the fills cover its inner half.
    if (P.bubbleEdge !== 'rgba(0,0,0,0)') {
      c.save()
      c.strokeStyle = P.bubbleEdge
      c.lineWidth = 1.32
      c.stroke(body)
      if (tailPath) {
        c.translate(tx, ty)
        c.stroke(tailPath)
      }
      c.restore()
    }
    c.fillStyle = fill
    c.fill(body)
    if (tailPath) {
      c.save()
      c.translate(tx, ty)
      c.fill(tailPath)
      c.restore()
    }
  }

  function drawAvatar(c: Ctx, cx: number, cy: number, r: number, asset: string | null | undefined, emoji?: string, color?: string, group = false) {
    const img = getImage(asset)
    c.save()
    circlePath(c, cx, cy, r)
    c.clip()
    if (img) drawCover(c, img, cx - r, cy - r, r * 2, r * 2)
    else if (emoji) {
      c.fillStyle = color ?? '#E6DAFF'
      c.fillRect(cx - r, cy - r, r * 2, r * 2)
      const size = r * 1.12
      drawEmoji(c, emoji, cx - size / 2, cy + size * 0.36, size)
    } else {
      // WhatsApp's grey placeholder with a person / people silhouette.
      const g = c.createRadialGradient(cx + r, cy - r, 0, cx + r, cy - r, r * 2.83)
      g.addColorStop(0, '#B1B5C0')
      g.addColorStop(1, '#858992')
      c.fillStyle = g
      c.fillRect(cx - r, cy - r, r * 2, r * 2)
      const icon = group ? WA_ICONS.group : WA_ICONS.person
      drawIcon(c, { ...icon, paths: icon.paths }, cx - r, cy - r, '#FFFFFF', r * 2)
    }
    c.restore()
  }

  function drawTime(c: Ctx, it: TimedItem, right: number, bottom: number, mine: boolean, t: number, onImage = false) {
    const label = clockOf(it)
    if (mine) {
      const read = project.receipts === 'read' && t >= it.readAt
      const delivered = t >= it.deliveredAt
      const icon = read ? WA_ICONS.read : delivered ? WA_ICONS.double : WA_ICONS.check
      const color = onImage ? '#FFFFFF' : read ? P.read : P.tick
      // Measured: tick glyph ends 10pt from the bubble edge, 7.4pt above its bottom.
      const boxX = right - 25
      const boxY = bottom - 20.07
      drawIcon(c, icon, boxX, boxY, color, 17)
      drawText(c, label, TIME, boxX - 1, bottom - 7.03, onImage ? '#FFFFFF' : P.time, 'right')
    } else {
      drawText(c, label, TIME, right - 11.1, bottom - 7.7, onImage ? '#FFFFFF' : P.time, 'right')
    }
  }

  function drawReactions(c: Ctx, it: TimedItem, bx: number, by: number, bw: number, mine: boolean, t: number) {
    const shown = it.reactions.filter((r) => t >= r.at)
    if (!shown.length) return
    const p = clamp((t - shown[0].at) / 0.35)
    const emojis = [...new Set(shown.map((r) => (r.emoji === 'HAHA' ? '😂' : r.emoji)))].slice(0, 3)
    const count = shown.length > 1 ? String(shown.length) : ''
    const countW = count ? measureText(count, COUNT) + 4.8 : 0
    const w = 9 + emojis.length * 16 + (emojis.length - 1) * 2 + countW + 9
    const h = WA.reactionH
    const x = mine ? bx + bw - 10 - w : bx + 10
    const y = by - WA.reactionOverlap
    const s = lerp(0.5, 1, springBounce(t - shown[0].at, 2.4, 0.6))
    c.save()
    c.globalAlpha = clamp(p * 3)
    c.translate(x + w / 2, y + h / 2)
    c.scale(s, s)
    c.translate(-(x + w / 2), -(y + h / 2))
    c.save()
    c.shadowColor = 'rgba(0,0,0,0.06)'
    c.shadowBlur = 0
    c.shadowOffsetY = 0.66 * scale
    c.fillStyle = P.reaction
    roundRectPath(c, x, y, w, h, 13)
    c.fill()
    c.restore()
    c.strokeStyle = P.reactionEdge
    c.lineWidth = 1
    roundRectPath(c, x, y, w, h, 13)
    c.stroke()
    emojis.forEach((e, i) => drawEmoji(c, e, x + 9 + i * 18, y + 18.1, 16))
    if (count) drawText(c, count, COUNT, x + 9 + emojis.length * 18 + 2.8, y + 17.3, P.time)
    c.restore()
  }

  // ---------- entries ----------
  const entries: Entry[] = []
  const chipEntry = (key: string, label: string, at: number, gap: number): Entry => {
    const tw = measureText(label, CHIP)
    return {
      key,
      inAt: at,
      outAt: Infinity,
      inDur: 0.3,
      gap,
      height: () => WA.dateH,
      draw: (c, top, p) => {
        const w = tw + 28
        const x = (W - w) / 2
        const y = top + 23
        c.save()
        c.globalAlpha = clamp(p * 1.4)
        c.strokeStyle = P.bubbleEdge
        c.lineWidth = 1.32
        roundRectPath(c, x, y, w, 20, 8)
        if (!dark) c.stroke()
        c.fillStyle = P.chip
        c.fill()
        drawText(c, label, CHIP, W / 2, y + 14.5, P.chipText, 'center')
        c.restore()
      },
    }
  }

  const firstStamp = items[0]?.kind === 'timestamp'
  if (!firstStamp) entries.push(chipEntry('date-auto', strings.today, 0, 0))

  let lastMsg: TimedItem | null = null
  let prevKind: string | null = null
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.kind === 'timestamp') {
      const raw = it.msg.text?.trim() || strings.today
      entries.push(chipEntry(`ts-${it.index}`, dayLabel(raw, locale, strings, project.chat.localizeStamps), it.appearAt, entries.length ? WA.gapOther : 0))
      lastMsg = null
      prevKind = 'chip'
      continue
    }
    if (it.kind === 'system') {
      entries.push(systemEntry(it, entries.length ? WA.gapOther : 0))
      lastMsg = null
      prevKind = 'chip'
      continue
    }
    const mine = it.side === 'me'
    const prev = lastMsg
    const gap = !entries.length ? 0 : prevKind === 'chip' || !prev ? WA.gapOther : prev.from?.id === it.from?.id ? WA.gapSame : WA.gapOther

    if (!mine) {
      it.typing.forEach(([a, b], k) => {
        const last = k === it.typing.length - 1 && it.kind !== 'typing'
        entries.push(typingEntry(it, a, last ? it.appearAt : b, gap, k))
      })
    }
    if (it.kind === 'typing') continue
    if (mine && !it.sent) continue

    const showName = isGroup && !mine && !prevSame.get(it.index)
    const lay = layouts.get(it.index)
    entries.push({
      key: `m-${it.index}`,
      inAt: it.appearAt,
      outAt: Infinity,
      inDur: 0.32,
      gap,
      height: (t) => {
        const r = it.reactions.length && t >= it.reactions[0].at ? (WA.reactionH - WA.reactionOverlap) * springIn(t - it.reactions[0].at, 0.3) : 0
        const h = it.kind === 'image' ? imageSize(it).h : lay!.h
        return h + (showName ? WA.nameH : 0) + r
      },
      draw: (c, top, p, t, hits) => drawMessage(c, it, lay ?? null, top, p, t, hits, showName),
    })
    lastMsg = it
    prevKind = it.kind
  }

  function personName(name?: string): { name: string; me: boolean } {
    if (!name) return { name: '', me: true }
    const p = timeline.participants.find((x) => x.id === name.trim().toLocaleLowerCase())
    return { name: p?.name ?? name, me: !!p?.isMe }
  }

  function systemText(it: TimedItem): string {
    const e = it.msg.system!
    if (e.type === 'custom') return e.text ?? ''
    const actor = personName(e.actor)
    const pick = (other: string, mine: string) => (actor.me ? mine : other)
    const w = strings.waSys
    const tpl =
      e.type === 'added'
        ? pick(w.added, w.addedMe)
        : e.type === 'removed'
          ? pick(w.removed, w.removedMe)
          : e.type === 'left'
            ? pick(w.left, w.leftMe)
            : e.type === 'renamed'
              ? pick(w.renamed, w.renamedMe)
              : pick(w.photo, w.photoMe)
    return tpl
      .replace('{actor}', actor.name)
      .replace('{target}', personName(e.target).name)
      .replace('{name}', e.text ?? '')
  }

  function systemEntry(it: TimedItem, gap: number): Entry {
    const tl = layoutText(systemText(it), SYSTEM, W - 96)
    const lines = Math.max(1, tl.lines.length)
    const h = 6 + lines * 15
    return {
      key: `sys-${it.index}`,
      inAt: it.appearAt,
      outAt: Infinity,
      inDur: 0.3,
      gap,
      height: () => h,
      draw: (c, top, p) => {
        const w = tl.width + 24
        const x = (W - w) / 2
        c.save()
        c.globalAlpha = clamp(p * 1.4)
        roundRectPath(c, x, top, w, h, 8)
        c.fillStyle = P.chip
        c.globalAlpha *= dark ? 1 : 0.92
        c.fill()
        c.globalAlpha = clamp(p * 1.4)
        drawTextLayout(c, tl, (W - tl.width) / 2, top + 15, 15, P.system, 'center', tl.width)
        c.restore()
      },
    }
  }

  function typingEntry(it: TimedItem, start: number, end: number, gap: number, k: number): Entry {
    const outDur = end < it.appearAt || it.kind === 'typing' ? 0.22 : 0.1
    return {
      key: `typing-${it.index}-${k}`,
      inAt: start,
      outAt: end,
      inDur: 0.3,
      outDur,
      gap,
      height: () => 31,
      draw: (c, top, p, t) => {
        const x = bubbleLeft
        const out = t >= end ? 1 - easeOutCubic((t - end) / outDur) : 1
        const s = lerp(0.6, 1, springBounce(t - start, 2.4, 0.62))
        c.save()
        c.globalAlpha = clamp(p * 3) * out
        c.translate(x, top + 31)
        c.scale(s, s)
        c.translate(-x, -(top + 31))
        bubbleShape(c, x, top, 40, 31, false, true, P.incoming)
        for (let d = 0; d < 3; d++) {
          const phase = ((t - start) * 1.4 - d * 0.2) % 1
          const kk = phase < 0 ? 0 : Math.max(0, Math.sin(Math.min(1, phase / 0.6) * Math.PI))
          c.globalAlpha = clamp(p * 3) * out * (0.4 + 0.6 * kk)
          c.fillStyle = P.dots
          circlePath(c, x + 11.55 + d * 8.5, top + 15.55, 2.75)
          c.fill()
        }
        c.restore()
        if (isGroup && it.from) {
          c.save()
          c.globalAlpha = clamp(p * 3) * out
          drawAvatar(c, 8 + WA.avatar / 2, top + 31 - WA.avatar / 2, WA.avatar / 2, it.from.avatar, it.from.emoji, it.from.color)
          c.restore()
        }
      },
    }
  }

  function drawMessage(c: Ctx, it: TimedItem, lay: BubbleLayout | null, top: number, p: number, t: number, hits: HitRect[], showName: boolean) {
    const mine = it.side === 'me'
    const age = t - it.appearAt
    const ns = nextSame.get(it.index)
    const tail = !ns || t < ns.appearAt
    let w = lay?.w ?? 0
    let h = lay?.h ?? 0
    if (it.kind === 'image') ({ w, h } = imageSize(it))
    const nameH = showName ? WA.nameH : 0
    if (showName && it.from) w = Math.max(w, Math.min(WA.maxText, measureText(it.from.name, NAME)) + 2 * WA.padX)
    const bh = h + nameH
    const x = mine ? W - WA.margin - w : bubbleLeft
    const y = top

    // Messages slide up a little and fade in.
    const a = easeOutCubic(age / 0.28)
    c.save()
    c.globalAlpha = clamp(age / 0.12) * clamp(p * 2)
    c.translate(0, (1 - a) * 10)

    bubbleShape(c, x, y, w, bh, mine, tail, mine ? P.outgoing : P.incoming)
    if (showName && it.from)
      drawText(c, ellipsize(it.from.name, NAME, w - 2 * WA.padX), NAME, x + WA.padX, y + WA.nameBaseline, nameColor.get(it.from.id) ?? NAME_COLORS[0])

    if (it.kind === 'image') {
      const img = getImage(it.msg.image)
      const ix = x + 3
      const iy = y + nameH + 3
      const iw = w - 6
      const ih = h - 6
      c.save()
      roundRectPath(c, ix, iy, iw, ih, 9)
      c.clip()
      if (img) drawCover(c, img, ix, iy, iw, ih)
      else {
        c.fillStyle = dark ? '#33383B' : '#E4DFD6'
        c.fillRect(ix, iy, iw, ih)
      }
      const g = c.createLinearGradient(0, iy + ih - 28, 0, iy + ih)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(0,0,0,0.38)')
      c.fillStyle = g
      c.fillRect(ix, iy + ih - 28, iw, 28)
      c.restore()
      drawTime(c, it, x + w - 2, y + bh - 1, mine, t, true)
    } else if (lay?.text) {
      drawTextLayout(c, lay.text, x + WA.padX, y + nameH + WA.baseline, WA.lineH, P.text)
      drawTime(c, it, x + w, y + bh, mine, t)
    }
    c.restore()

    if (isGroup && !mine && tail && it.from) {
      c.save()
      c.globalAlpha = clamp(age / 0.12)
      drawAvatar(c, 8 + WA.avatar / 2, y + bh - WA.avatar / 2, WA.avatar / 2, it.from.avatar, it.from.emoji, it.from.color)
      c.restore()
    }
    if (it.reactions.length) drawReactions(c, it, x, y + bh, w, mine, t)
    hits.push({ id: it.msg.id, x, y, w, h: bh })
  }

  // ---------- header ----------
  const other = others[0] ?? null
  const baseTitle = project.chat.title || (isGroup ? others.map((p) => p.name).join(', ') : (other?.name ?? ''))
  const renames = items.filter((it) => it.kind === 'system' && it.msg.system?.type === 'renamed' && it.msg.system.text)
  const titleAt = (t: number) => {
    let title = baseTitle
    for (const r of renames) if (t >= r.appearAt) title = r.msg.system!.text!
    return title
  }
  const memberList = others.map((p) => p.name).join(', ')

  /** Who is typing at t (their typing bubble is up). */
  function typistAt(t: number): TimedItem | null {
    for (const it of items) if (it.side !== 'me' && it.typing.some(([a, b]) => t >= a && t < b)) return it
    return null
  }

  const headerH = dev.safeTop + 39
  function drawHeader(c: Ctx, t: number) {
    blurRegion(c, 0, 0, W, headerH, 14)
    c.fillStyle = P.bar
    c.fillRect(0, 0, W, headerH)
    const row = dev.safeTop - 1
    drawIcon(c, WA_ICONS.chevron, 0, row + 2, P.ink)
    let ax = 31
    if (project.chat.unread > 0) {
      drawText(c, String(project.chat.unread), UNREAD, 31, row + 24, P.ink)
      ax = 31 + Math.max(31, measureText(String(project.chat.unread), UNREAD) + 6) - 1
    }
    // Avatar
    const groupPhoto = isGroup && !project.chat.avatar
    drawAvatar(
      c,
      ax + 18,
      row + 18,
      18,
      project.chat.avatar ?? (isGroup ? null : other?.avatar),
      isGroup ? undefined : other?.emoji,
      isGroup ? undefined : other?.color,
      groupPhoto,
    )
    // Name + status line
    const tx = ax + 46
    const maxW = W - 121 - tx
    drawText(c, ellipsize(titleAt(t), TITLE, maxW), TITLE, tx, row + 17, P.ink)
    const typist = typistAt(t)
    const status = typist
      ? isGroup
        ? strings.waTypingName.replace('{name}', typist.from?.name.split(' ')[0] ?? '')
        : strings.typing
      : isGroup
        ? memberList || strings.waGroupInfo
        : strings.waContactInfo
    drawText(c, ellipsize(status, SUBTITLE, maxW), SUBTITLE, tx, row + 30.8, P.sub)
    drawIcon(c, WA_ICONS.video, W - 102, row + 1, P.ink)
    drawIcon(c, WA_ICONS.phone, W - 54, row + 1, P.ink)
  }

  // ---------- input bar + keyboard ----------
  function kbProgress(t: number): number {
    if (kbMode === 'always') return 1
    if (kbMode === 'off') return 0
    let p = 0
    for (const s of timeline.keyboardSpans) {
      if (t < s.openAt) continue
      const pin = springIn(t - s.openAt, 0.5)
      const pout = t < s.closeAt ? 1 : 1 - easeInOutCubic((t - s.closeAt) / 0.38)
      p = Math.max(p, Math.min(pin, pout))
    }
    return clamp(p)
  }

  function composer(t: number): { text: string; lastKey: number } {
    for (const it of items) {
      if (it.side !== 'me' || it.composeStart === null || !it.keys.length) continue
      const end = it.sent ? it.appearAt : it.keys[it.keys.length - 1].at + 0.05
      if (t < it.composeStart || t >= end) continue
      let text = ''
      let lastKey = -1
      for (const k of it.keys) {
        if (k.at > t) break
        text = k.text
        lastKey = k.at
      }
      return { text, lastKey }
    }
    return { text: '', lastKey: -1 }
  }

  function inputMetrics(t: number) {
    const p = kbProgress(t)
    const kbTop = H - KEYBOARD_HEIGHT * p
    const { text, lastKey } = composer(t)
    const writing = text.length > 0
    const fx = 47
    const fw = writing ? W - 97 : W - 141
    const textMax = fw - 20 - 30
    const tl = writing ? layoutText(text, INPUT, textMax) : null
    const lines = tl ? Math.min(5, tl.lines.length) : 1
    const barH = WA.barH + (lines - 1) * WA.fieldLineH
    const barTop = lerp(H - dev.safeBottom - barH, kbTop - barH, p)
    return { p, kbTop, barTop, barH, fx, fw, fh: 29 + (lines - 1) * WA.fieldLineH, text, tl, lines, writing, lastKey }
  }

  function drawInput(c: Ctx, t: number) {
    const m = inputMetrics(t)
    blurRegion(c, 0, m.barTop, W, H - m.barTop, 14)
    c.fillStyle = P.bar
    c.fillRect(0, m.barTop, W, H - m.barTop)
    const bottom = m.barTop + m.barH
    drawIcon(c, WA_ICONS.plus, 7, bottom - 37.5, P.ink)
    // Text field
    const fy = m.barTop + 7
    roundRectPath(c, m.fx, fy, m.fw, m.fh, 15)
    c.fillStyle = P.field
    c.fill()
    c.strokeStyle = P.fieldEdge
    c.lineWidth = 0.66
    c.stroke()
    drawIcon(c, WA_ICONS.sticker, m.fx + m.fw - 33, bottom - 33, P.ink, 24)
    if (m.tl) {
      const visible = m.tl.lines.slice(-5)
      drawTextLayout(c, { ...m.tl, lines: visible }, m.fx + 10, fy + 19.2, WA.fieldLineH, P.text)
      const last = visible[visible.length - 1]
      drawCaret(c, m.fx + 10 + last.width + 1, fy + 4 + (visible.length - 1) * WA.fieldLineH, t, m.lastKey)
      // Send button
      c.fillStyle = P.send
      circlePath(c, W - 41 + 16, bottom - 37.5 + 16, 16)
      c.fill()
      drawIcon(c, WA_ICONS.send, W - 41 + 4, bottom - 37.5 + 4, '#FFFFFF', 24)
    } else {
      if (m.p > 0.6) drawCaret(c, m.fx + 10, fy + 4, t, m.lastKey)
      drawIcon(c, WA_ICONS.camera, W - 80, bottom - 37.5, P.ink)
      drawIcon(c, WA_ICONS.mic, W - 41, bottom - 37.5, P.ink)
    }
    if (m.p > 0.001) {
      const upper = m.text === '' || /[.!?]\s$/.test(m.text)
      drawKeyboard(c, W, m.kbTop, KEYBOARD_HEIGHT, kbColors, locale, t, timeline.keys, upper)
    }
  }

  function drawCaret(c: Ctx, x: number, y: number, t: number, lastKey: number) {
    const typing = lastKey >= 0 && t - lastKey < 0.55
    if (!typing && Math.floor(t * 1.9) % 2 === 1) return
    c.fillStyle = P.send
    roundRectPath(c, x, y, 2, 21, 1)
    c.fill()
  }

  // ---------- frame ----------
  let lastHits: HitRect[] = []
  return {
    draw(c: Ctx, t: number) {
      c.save()
      // Wallpaper
      const paper = dark ? waWallpaper.dark : waWallpaper.light
      c.fillStyle = P.paper
      c.fillRect(0, 0, W, H)
      if (paper)
        drawCover(
          c,
          paper as CanvasImageSource,
          0,
          0,
          W,
          H,
          (paper as HTMLImageElement).naturalWidth || (paper as HTMLCanvasElement).width,
          (paper as HTMLImageElement).naturalHeight || (paper as HTMLCanvasElement).height,
        )

      const im = inputMetrics(t)
      const { placed, bottom } = layoutEntries(entries, t, headerH)
      const viewportBottom = im.barTop - 8
      const offset = Math.max(0, bottom - viewportBottom)
      const hits: HitRect[] = []
      for (const pl of placed) {
        const y = pl.y - offset
        if (y + pl.h < -60 || y > H + 60) continue
        pl.e.draw(c, y, pl.p, t, hits)
      }
      lastHits = hits

      drawHeader(c, t)
      drawInput(c, t)
      drawStatusBar(c, dev, project.status, dark ? '#FFFFFF' : '#000000', W)
      c.restore()
    },
    hitTest(x: number, y: number) {
      return hitTestRects(lastHits, x, y)
    },
  }
}
