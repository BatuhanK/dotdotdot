import { getImage } from '../lib/assets'
import { stampLabel } from '../lib/datetime'
import { formatClock } from '../lib/i18n'
import type { TimedItem } from '../lib/timeline'
import { bigEmojiCount, drawEmoji } from './emoji'
import { drawKeyboard, drawMicGlyph, KB_DARK, KB_LIGHT, KEYBOARD_HEIGHT } from './keyboard'
import { hitTestRects, initials, layoutEntries, type ChatScene, type Entry, type HitRect, type SceneInput } from './scene'
import { drawStatusBar } from './statusbar'
import { drawText, drawTextLayout, ellipsize, layoutText, measureText, type TextLayout } from './text'
import {
  circlePath,
  clamp,
  drawCover,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  progressiveBlur,
  roundRectPath,
  smoothPolyline,
  springBounce,
  springIn,
  type Ctx,
} from './util'

/*
 * iOS 26 Messages conversation screen.
 * Metrics are in points and come from measuring 3x simulator screenshots of iPhone 17 Pro (402×874);
 * colours come from ChatKit's asset catalog (CKBlueBalloonColor0/1 etc.).
 */
const M = {
  margin: 16,
  padX: 14,
  minH: 40,
  lineH: 20,
  baseline: 25.85,
  radius: 20,
  gapSame: 4,
  gapOther: 10,
  tsLineH: 14,
  tsBaseline: 9.9,
  tsGapBefore: 18,
  tsGapAfter: 6.33,
  receiptGap: 6,
  receiptH: 13.33,
  receiptInset: 20,
  contentTop: 109,
  groupAvatar: 28,
  groupIndent: 40,
}

interface Palette {
  bg: string
  incoming: string
  incomingText: string
  outgoingText: string
  grad: [string, string]
  secondary: string
  glass: string
  glassBorder: string | null
  glassShadow: string
  icon: string
  titleText: string
  titleChevron: string
  placeholder: string
  mic: string
  typingDot: string
  avatarSil: [string, string]
  monogram: [string, string]
  send: string
  heart: string
}

const LIGHT: Omit<Palette, 'grad'> = {
  bg: '#FFFFFF',
  incoming: '#E9E9EB',
  incomingText: '#000000',
  outgoingText: '#FFFFFF',
  secondary: 'rgba(60,60,67,0.6)',
  glass: '#FFFFFF',
  glassBorder: null,
  glassShadow: 'rgba(0,0,0,0.075)',
  icon: '#1A1A1A',
  titleText: '#1A1919',
  titleChevron: '#BDBDBD',
  placeholder: '#BDBDBD',
  mic: '#B4B8BF',
  typingDot: '#8E8E93',
  avatarSil: ['#A7C0E0', '#7582BA'],
  monogram: ['#A6ABB8', '#868B97'],
  send: '#0088FF',
  heart: '#FA5E96',
}

const DARK: Omit<Palette, 'grad'> = {
  bg: '#000000',
  incoming: '#262628',
  incomingText: '#FFFFFF',
  outgoingText: '#FFFFFF',
  secondary: 'rgba(235,235,245,0.6)',
  glass: '#191919',
  glassBorder: '#2E2E2E',
  glassShadow: 'rgba(0,0,0,0)',
  icon: '#F4F3F4',
  titleText: '#F4F3F4',
  titleChevron: '#5D5D5D',
  placeholder: '#5D5D5D',
  mic: '#636466',
  typingDot: '#8D8D93',
  avatarSil: ['#555167', '#31284A'],
  monogram: ['#6E717B', '#4B4E57'],
  send: '#0091FF',
  heart: '#FA5E96',
}

const GRADIENTS = {
  imessage: { light: ['#5AC8FA', '#0088FF'], dark: ['#409CFF', '#0091FF'] },
  sms: { light: ['#53E678', '#34C759'], dark: ['#30DB5B', '#34C759'] },
} as const

/*
 * Tail outline relative to the bubble's bottom-right corner (outgoing), traced from the reference.
 * Starts on the bubble's bottom edge, runs to the tip, and climbs back into the bubble's side.
 */
const TAIL: [number, number][] = [
  [-22.5, -0.6],
  [-21.9, 0],
  [-19.9, 0.84],
  [-17.9, 2.22],
  [-15.9, 3.59],
  [-13.9, 4.84],
  [-11.9, 5.89],
  [-9.9, 6.79],
  [-8.55, 6.95],
  [-8.15, 6.2],
  [-8.4, 5.2],
  [-8.95, 4.3],
  [-9.5, 3.44],
  [-9.95, 2.44],
  [-10.3, 1.44],
  [-10.45, 0.44],
  [-10.3, -0.56],
  [-10.05, -1.56],
  [-9.5, -2.56],
  [-8.75, -3.56],
  [-7.55, -4.56],
  [-6.2, -5.6],
]

/** Big emoji are laid out with extra space between glyphs (measured: 4.33pt for two). */
function spreadEmoji(tl: TextLayout, gap: number): TextLayout {
  if (!gap) return tl
  const lines = tl.lines.map((l) => {
    let shift = 0
    const frags = l.frags.map((f, i) => {
      const nf = { ...f, x: f.x + shift }
      if (i < l.frags.length - 1) shift += gap
      return nf
    })
    return { ...l, frags, width: l.width + shift }
  })
  return { ...tl, lines, width: Math.max(...lines.map((l) => l.width)) }
}

interface BubbleLayout {
  kind: 'bubble' | 'emoji' | 'image'
  text?: TextLayout
  w: number
  h: number
  emojiCount?: number
  emojiSize?: number
}

const PASTELS = ['#FFD6E0', '#FFE5B4', '#D7F5D1', '#D3E8FF', '#E6DAFF', '#FFF3B0', '#C9F2EE', '#FFD8C2']
/** Stable pastel background for emoji avatars. */
function pastel(seed: string): string {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return PASTELS[h % PASTELS.length]
}

export function createIMessageScene(input: SceneInput): ChatScene {
  const { project, timeline, device: dev, width: W, height: H, scale, strings } = input
  const dark = project.appearance === 'dark'
  const base = dark ? DARK : LIGHT
  const grad = GRADIENTS[project.chat.service][dark ? 'dark' : 'light'] as unknown as [string, string]
  const P: Palette = { ...base, grad: [grad[0], grad[1]] }
  const kbColors = dark ? KB_DARK : KB_LIGHT
  const others = timeline.participants.filter((p) => !p.isMe)
  const isGroup = others.length > 1 || project.chat.group
  const indent = isGroup ? M.groupIndent : 0
  const maxTextW = Math.round(W * 0.6206 * 10) / 10
  const bodyFont = { size: 17, weight: 400 }
  const items = timeline.items
  const kbMode = project.keyboard
  const locale = project.locale

  // ---------- static layouts ----------
  const layouts = new Map<number, BubbleLayout>()
  for (const it of items) {
    if (it.kind === 'timestamp' || it.kind === 'typing' || it.kind === 'system') continue
    if (it.kind === 'image') {
      layouts.set(it.index, { kind: 'image', w: 0, h: 0 })
      continue
    }
    const text = it.msg.text ?? ''
    const n = bigEmojiCount(text)
    if (n) {
      const size = n === 1 ? 72 : 48
      const tl = spreadEmoji(layoutText(text.replace(/\s+/g, ''), { size: 17 }, 1e6, size), n === 1 ? 0 : 4.33)
      layouts.set(it.index, { kind: 'emoji', text: tl, w: tl.width, h: n === 1 ? 112.67 : 84, emojiCount: n, emojiSize: size })
      continue
    }
    const tl = layoutText(text || ' ', bodyFont, maxTextW)
    const lines = Math.max(1, tl.lines.length)
    layouts.set(it.index, { kind: 'bubble', text: tl, w: Math.ceil((tl.width + 2 * M.padX) * 3) / 3, h: M.minH + (lines - 1) * M.lineH })
  }

  function imageSize(it: TimedItem): { w: number; h: number } {
    const img = getImage(it.msg.image)
    const maxW = Math.round(W * 0.62)
    if (!img) return { w: maxW, h: Math.round(maxW * 0.75) }
    const ar = img.naturalWidth / img.naturalHeight
    let w = maxW
    let h = w / ar
    if (h > 330) {
      h = 330
      w = Math.max(120, h * ar)
    }
    return { w: Math.round(w), h: Math.round(Math.max(90, h)) }
  }

  // Consecutive messages from the same sender form a group; only the last one has a tail.
  const nextSame = new Map<number, TimedItem | null>()
  const prevSame = new Map<number, TimedItem | null>()
  const bubbleItems = items.filter((it) => it.kind !== 'typing')
  for (let i = 0; i < bubbleItems.length; i++) {
    const it = bubbleItems[i]
    if (it.kind === 'timestamp') continue
    const n = bubbleItems[i + 1]
    nextSame.set(it.index, n && n.kind !== 'timestamp' && n.from?.id === it.from?.id ? n : null)
    const p = bubbleItems[i - 1]
    prevSame.set(it.index, p && p.kind !== 'timestamp' && p.from?.id === it.from?.id ? p : null)
  }

  // ---------- helpers ----------
  const shadow =
    (blur: number, color = P.glassShadow, oy = 0) =>
    (c: Ctx) => {
      c.shadowColor = color
      c.shadowBlur = blur * scale
      c.shadowOffsetY = oy * scale
    }

  function gradientFill(c: Ctx): CanvasGradient {
    const g = c.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, P.grad[0])
    g.addColorStop(1, P.grad[1])
    return g
  }

  function fillBubble(c: Ctx, x: number, y: number, w: number, h: number, mine: boolean, tail: boolean, fill: string | CanvasGradient) {
    c.fillStyle = fill
    c.beginPath()
    c.roundRect(x, y, w, h, Math.min(M.radius, h / 2))
    c.fill()
    if (!tail) return
    const R = mine ? x + w : x
    const B = y + h
    const pts = TAIL.map(([dx, dy]) => [mine ? R + dx : R - dx, B + dy] as [number, number])
    c.beginPath()
    c.moveTo(pts[0][0], pts[0][1])
    smoothPolyline(c, pts, false)
    c.lineTo(mine ? R - 22.5 : R + 22.5, B - 8)
    c.closePath()
    c.fill()
  }

  function drawAvatar(c: Ctx, cx: number, cy: number, r: number, asset: string | null | undefined, name: string, emoji?: string, color?: string) {
    const img = getImage(asset)
    c.save()
    circlePath(c, cx, cy, r)
    c.clip()
    if (img) {
      drawCover(c, img, cx - r, cy - r, r * 2, r * 2)
    } else if (emoji) {
      c.fillStyle = color ?? pastel(name)
      c.fillRect(cx - r, cy - r, r * 2, r * 2)
      const size = r * 1.12
      drawEmoji(c, emoji, cx - size / 2, cy + size * 0.36, size)
    } else if (name) {
      const g = c.createLinearGradient(0, cy - r, 0, cy + r)
      g.addColorStop(0, P.monogram[0])
      g.addColorStop(1, P.monogram[1])
      c.fillStyle = g
      c.fillRect(cx - r, cy - r, r * 2, r * 2)
      const ini = initials(name)
      const size = r * 0.86
      drawText(c, ini, { size, weight: 600, letterSpacing: size * 0.01 }, cx, cy + size * 0.355, '#FFFFFF', 'center')
    } else {
      const g = c.createLinearGradient(0, cy - r, 0, cy + r)
      g.addColorStop(0, P.avatarSil[0])
      g.addColorStop(1, P.avatarSil[1])
      c.fillStyle = g
      c.fillRect(cx - r, cy - r, r * 2, r * 2)
      c.fillStyle = '#FFFFFF'
      circlePath(c, cx, cy - r * 0.27, r * 0.31)
      c.fill()
      c.beginPath()
      c.ellipse(cx, cy + r * 0.62, r * 0.6, r * 0.42, 0, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()
  }

  function drawTapback(c: Ctx, bx: number, by: number, bw: number, mine: boolean, reactorMine: boolean, emoji: string, p: number) {
    // Tapback sits on the bubble's top corner opposite to the tail.
    const size = 31
    const cx = mine ? bx + 1 : bx + bw - 1
    const cy = by - 9
    const s = lerp(0.4, 1, springBounce(p * 0.6, 2.4, 0.55))
    c.save()
    c.globalAlpha = clamp(p * 4)
    c.translate(cx, cy)
    c.scale(s, s)
    const fill = reactorMine ? P.grad[1] : P.incoming
    // outline ring in background colour
    c.fillStyle = P.bg
    circlePath(c, 0, 0, size / 2 + 2)
    c.fill()
    circlePath(c, (mine ? 1 : -1) * 11, 12.5, 5.5)
    c.fill()
    c.fillStyle = fill
    circlePath(c, 0, 0, size / 2)
    c.fill()
    circlePath(c, (mine ? 1 : -1) * 11, 12.5, 3.6)
    c.fill()
    circlePath(c, (mine ? 1 : -1) * 15.5, 17, 1.7)
    c.fill()
    const glyphColor = reactorMine ? '#FFFFFF' : P.heart
    if (emoji === '❤️' || emoji === '♥️') {
      c.fillStyle = reactorMine ? '#FFFFFF' : P.heart
      c.beginPath()
      c.moveTo(0, 6.2)
      c.bezierCurveTo(-9.5, 0.2, -8.6, -7.4, -4.2, -7.4)
      c.bezierCurveTo(-1.9, -7.4, -0.5, -5.9, 0, -4.5)
      c.bezierCurveTo(0.5, -5.9, 1.9, -7.4, 4.2, -7.4)
      c.bezierCurveTo(8.6, -7.4, 9.5, 0.2, 0, 6.2)
      c.fill()
    } else if (emoji === 'HAHA') {
      drawText(c, 'HA', { size: 10, weight: 800 }, 0, -1, reactorMine ? '#FFFFFF' : P.typingDot, 'center')
      drawText(c, 'HA', { size: 10, weight: 800 }, 0, 8, reactorMine ? '#FFFFFF' : P.typingDot, 'center')
    } else if (emoji === '‼️' || emoji === '❓') {
      drawText(c, emoji === '‼️' ? '!!' : '?', { size: 17, weight: 800 }, 0, 6, reactorMine ? '#FFFFFF' : glyphColor, 'center')
    } else {
      const tl = layoutText(emoji, { size: 17 }, 1e6, 17)
      drawTextLayout(c, tl, -tl.width / 2, 6, 0, '#000')
    }
    c.restore()
  }

  // ---------- entries ----------
  const entries: Entry[] = []
  let firstTimestampDone = false
  const leadingTs = items[0]?.kind === 'timestamp'

  const tsEntry = (key: string, label: string, withService: boolean, at: number, gap: number): Entry => {
    const lines = withService ? [project.chat.service === 'sms' ? strings.sms : strings.imessage, label] : [label]
    return {
      key,
      inAt: at,
      outAt: Infinity,
      inDur: 0.3,
      gap,
      height: () => lines.length * M.tsLineH,
      draw: (c, top, p) => {
        c.save()
        c.globalAlpha = clamp(p * 1.4)
        lines.forEach((l, i) => drawText(c, l, { size: 11, weight: 400 }, W / 2, top + i * M.tsLineH + M.tsBaseline, P.secondary, 'center'))
        c.restore()
      },
    }
  }

  const defaultTsLabel = `${strings.today} ${formatClock(project.chat.clock, project.clock24)}`
  if (!leadingTs && items.length) entries.push(tsEntry('ts-auto', defaultTsLabel, true, 0, 0))
  else if (!items.length) entries.push(tsEntry('ts-auto', defaultTsLabel, true, 0, 0))

  let lastMsg: TimedItem | null = null
  let prevKind: string | null = null
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.kind === 'timestamp') {
      const raw = it.msg.text?.trim()
      const label = raw ? stampLabel(raw, project.locale, project.clock24, strings, project.chat.localizeStamps) : defaultTsLabel
      entries.push(tsEntry(`ts-${it.index}`, label, !firstTimestampDone && i === 0, it.appearAt, entries.length ? M.tsGapBefore : 0))
      firstTimestampDone = true
      lastMsg = null
      prevKind = 'timestamp'
      continue
    }
    if (it.kind === 'system') {
      entries.push(systemEntry(it, entries.length ? M.tsGapBefore : 0))
      lastMsg = null
      prevKind = 'timestamp'
      continue
    }
    const mine = it.side === 'me'
    const prev = lastMsg
    const gap = !entries.length ? 0 : prevKind === 'timestamp' || !prev ? M.tsGapAfter : prev.from?.id === it.from?.id ? M.gapSame : M.gapOther
    const showName = isGroup && !mine && !prevSame.get(it.index)
    const nameH = showName ? 16 : 0

    // Their typing bubble — it can stop and start again before the message arrives.
    if (!mine) {
      it.typing.forEach(([a, b], k) => {
        const last = k === it.typing.length - 1 && it.kind !== 'typing'
        entries.push(makeTyping(it, a, last ? it.appearAt : b, gap, showName, k))
      })
    }
    if (it.kind === 'typing') continue

    const lay = layouts.get(it.index)!
    const reactionsH = it.reactions.length ? 22 : 0
    const entry: Entry = {
      key: `m-${it.index}`,
      inAt: it.appearAt,
      outAt: Infinity,
      inDur: 0.45,
      gap,
      height: (t) => {
        const r = it.reactions.length ? reactionsH * springIn(t - it.reactions[0].at, 0.35) : 0
        // Text cells are 1px (at 3x) taller than the bubble they draw.
        const h = lay.kind === 'image' ? imageSize(it).h : lay.kind === 'bubble' ? lay.h + 0.33 : lay.h
        return h + nameH + r
      },
      draw: (c, top, p, t, hits) => drawMessage(c, it, lay, top, p, t, hits, showName, nameH, reactionsH),
    }
    entries.push(entry)

    if (mine && project.receipts !== 'none') {
      const nextMine = items.slice(i + 1).find((x) => x.side === 'me' && x.sent && x.kind !== 'typing')
      entries.push({
        key: `r-${it.index}`,
        inAt: it.deliveredAt,
        outAt: nextMine ? nextMine.appearAt : Infinity,
        inDur: 0.35,
        outDur: 0.3,
        gap: M.receiptGap,
        height: () => M.receiptH,
        draw: (c, top, p, t) => {
          const read = !isGroup && t >= it.readAt
          const label = read ? `${strings.read} ${formatClock(it.clock, project.clock24)}` : strings.delivered
          c.save()
          c.globalAlpha = clamp(p * 1.3)
          drawText(c, label, { size: 11, weight: 600 }, W - M.margin - M.receiptInset, top + 10.3, P.secondary, 'right')
          c.restore()
        },
      })
    }
    lastMsg = it
    prevKind = it.kind
  }

  /** Name for a system event participant ("You" forms are separate strings). */
  function personName(name?: string): { name: string; me: boolean } {
    if (!name) return { name: '', me: true }
    const p = timeline.participants.find((x) => x.id === name.trim().toLocaleLowerCase())
    return { name: p?.name ?? name, me: !!p?.isMe }
  }

  function systemText(it: TimedItem): string {
    const e = it.msg.system!
    if (e.type === 'custom') return e.text ?? ''
    const actor = personName(e.actor)
    const target = personName(e.target).name
    const pick = (other: string, mine: string) => (actor.me ? mine : other)
    const tpl =
      e.type === 'added'
        ? pick(strings.sysAdded, strings.sysAddedMe)
        : e.type === 'removed'
          ? pick(strings.sysRemoved, strings.sysRemovedMe)
          : e.type === 'left'
            ? pick(strings.sysLeft, strings.sysLeftMe)
            : e.type === 'renamed'
              ? pick(strings.sysRenamed, strings.sysRenamedMe)
              : pick(strings.sysPhoto, strings.sysPhotoMe)
    return tpl
      .replace('{actor}', actor.name)
      .replace('{target}', target)
      .replace('{name}', e.text ?? '')
  }

  function systemEntry(it: TimedItem, gap: number): Entry {
    const tl = layoutText(systemText(it), { size: 11, weight: 400 }, W - 56)
    const lines = Math.max(1, tl.lines.length)
    return {
      key: `sys-${it.index}`,
      inAt: it.appearAt,
      outAt: Infinity,
      inDur: 0.3,
      gap,
      height: () => lines * M.tsLineH,
      draw: (c, top, p) => {
        c.save()
        c.globalAlpha = clamp(p * 1.4)
        drawTextLayout(c, tl, (W - tl.width) / 2, top + M.tsBaseline, M.tsLineH, P.secondary, 'center', tl.width)
        c.restore()
      },
    }
  }

  function makeTyping(it: TimedItem, start: number, end: number, gap: number, showName: boolean, k: number): Entry {
    const nameH = showName ? 16 : 0
    const outDur = end < it.appearAt || it.kind === 'typing' ? 0.25 : 0.12
    return {
      key: `typing-${it.index}-${k}`,
      inAt: start,
      outAt: end,
      inDur: 0.42,
      outDur,
      gap,
      height: () => 40 + nameH,
      draw: (c, top, p, t) => {
        const x = M.margin + indent
        const y = top + nameH
        if (showName && it.from) drawText(c, it.from.name, { size: 11, weight: 400 }, x + 13, top + 11, P.secondary)
        const s = springBounce(t - start, 2.2, 0.6)
        const out = t >= end ? 1 - easeOutCubic((t - end) / outDur) : 1
        c.save()
        c.globalAlpha = clamp(p * 3) * out
        c.translate(x, y + 40)
        c.scale(lerp(0.3, 1, s), lerp(0.3, 1, s))
        c.translate(-x, -(y + 40))
        c.fillStyle = P.incoming
        c.beginPath()
        c.roundRect(x, y, 60, 40, 20)
        c.fill()
        circlePath(c, x + 3.2, y + 36.6, 6.4)
        c.fill()
        circlePath(c, x - 2.6, y + 45, 3)
        c.fill()
        // Dots light up one after another.
        for (let d = 0; d < 3; d++) {
          const phase = ((t - start) * 1.55 - d * 0.18) % 1
          const kk = phase < 0 ? 0 : Math.max(0, Math.sin(Math.min(1, phase / 0.6) * Math.PI))
          c.globalAlpha = clamp(p * 3) * out * (0.42 + 0.58 * kk)
          c.fillStyle = P.typingDot
          circlePath(c, x + 17.8 + d * 12.2, y + 20, 4.65)
          c.fill()
        }
        c.restore()
        if (isGroup && it.from) {
          c.save()
          c.globalAlpha = clamp(p * 3) * out
          drawAvatar(c, M.margin + M.groupAvatar / 2, y + 40 - M.groupAvatar / 2, M.groupAvatar / 2, it.from.avatar, it.from.name, it.from.emoji, it.from.color)
          c.restore()
        }
      },
    }
  }

  function drawMessage(
    c: Ctx,
    it: TimedItem,
    lay: BubbleLayout,
    top: number,
    p: number,
    t: number,
    hits: HitRect[],
    showName: boolean,
    nameH: number,
    reactionsH: number,
  ) {
    const mine = it.side === 'me'
    const age = t - it.appearAt
    const rp = it.reactions.length ? springIn(t - it.reactions[0].at, 0.35) : 0
    const y = top + nameH + reactionsH * rp
    const ns = nextSame.get(it.index)
    const tail = !ns || t < ns.appearAt
    let w = lay.w
    let h = lay.h
    if (lay.kind === 'image') ({ w, h } = imageSize(it))
    const x = mine ? W - M.margin - w : M.margin + indent

    if (showName && it.from) {
      c.save()
      c.globalAlpha = clamp(p * 2)
      drawText(c, it.from.name, { size: 11, weight: 400 }, x + 13, top + 11, P.secondary)
      c.restore()
    }

    // Appear animation.
    const a = springBounce(age, 2.1, 0.68)
    const alpha = clamp(age / 0.1)
    c.save()
    c.globalAlpha = alpha
    if (mine) {
      const s = lerp(0.88, 1, a)
      const ty = (1 - a) * 22
      c.translate(x + w, y + h + ty)
      c.scale(s, s)
      c.translate(-(x + w), -(y + h))
    } else {
      const s = lerp(0.55, 1, a)
      c.translate(x, y + h)
      c.scale(s, s)
      c.translate(-x, -(y + h))
    }

    if (lay.kind === 'emoji' && lay.text) {
      const tl = lay.text
      const ex = mine ? W - M.margin - tl.width - 2.5 : x + 2.5
      const base = y + (lay.emojiCount === 1 ? 80 : 57.9)
      drawTextLayout(c, tl, ex, base, 0, '#000')
    } else if (lay.kind === 'image') {
      const img = getImage(it.msg.image)
      c.save()
      roundRectPath(c, x, y, w, h, 18)
      c.clip()
      if (img) drawCover(c, img, x, y, w, h)
      else {
        c.fillStyle = P.incoming
        c.fillRect(x, y, w, h)
        drawText(c, '🖼️', { size: 17 }, x + w / 2, y + h / 2 + 8, '#000', 'center')
      }
      c.restore()
    } else if (lay.text) {
      fillBubble(c, x, y, w, h, mine, tail, mine ? gradientFill(c) : P.incoming)
      drawTextLayout(c, lay.text, x + M.padX, y + M.baseline, M.lineH, mine ? P.outgoingText : P.incomingText)
    }
    c.restore()

    if (isGroup && !mine && tail && it.from) {
      c.save()
      c.globalAlpha = alpha
      drawAvatar(c, M.margin + M.groupAvatar / 2, y + h - M.groupAvatar / 2, M.groupAvatar / 2, it.from.avatar, it.from.name, it.from.emoji, it.from.color)
      c.restore()
    }

    // Tapbacks.
    it.reactions.forEach((r, i) => {
      const rp2 = clamp((t - r.at) / 0.5)
      if (t < r.at) return
      drawTapback(c, x + (mine ? -i * 9 : i * 9), y, w, mine, r.mine, r.emoji, rp2)
    })

    hits.push({ id: it.msg.id, x, y, w, h })
  }

  // ---------- chrome ----------
  const other = others[0] ?? null
  const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n
  const groupNames = () => {
    const n = others.map((p) => firstName(p.name))
    if (n.length <= 1) return n[0] ?? ''
    if (n.length === 2) return `${n[0]} ${strings.and} ${n[1]}`
    if (n.length === 3) return `${n[0]}, ${n[1]} ${strings.and} ${n[2]}`
    return `${n[0]}, ${n[1]} ${strings.and} ${strings.more.replace('{n}', String(n.length - 2))}`
  }
  const baseTitle = project.chat.title || (isGroup ? groupNames() : (other?.name ?? ''))
  const renames = items.filter((it) => it.kind === 'system' && it.msg.system?.type === 'renamed' && it.msg.system.text)
  /** Header title at time t — "named the conversation" events rename the group live. */
  const titleAt = (t: number) => {
    let title = baseTitle
    for (const r of renames) if (t >= r.appearAt) title = r.msg.system!.text!
    return title
  }
  const avatarAsset = project.chat.avatar ?? other?.avatar ?? null

  function glass(c: Ctx, path: () => void) {
    c.save()
    shadow(18)(c)
    c.fillStyle = P.glass
    path()
    c.fill()
    c.restore()
    if (P.glassBorder) {
      c.save()
      c.strokeStyle = P.glassBorder
      c.lineWidth = 1 / scale
      path()
      c.stroke()
      c.restore()
    }
  }

  function drawHeader(c: Ctx, t: number) {
    const top = dev.safeTop
    const title = titleAt(t)
    // Back button
    glass(c, () => circlePath(c, M.margin + 22, top + 22, 22))
    c.save()
    c.strokeStyle = P.icon
    c.lineWidth = 2.15
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.beginPath()
    c.moveTo(M.margin + 25.1, top + 14.0)
    c.lineTo(M.margin + 16.1, top + 22.33)
    c.lineTo(M.margin + 25.1, top + 30.67)
    c.stroke()
    c.restore()
    if (project.chat.unread > 0) {
      const label = String(project.chat.unread)
      const tw = measureText(label, { size: 13, weight: 600 })
      const bw = Math.max(20, tw + 11)
      c.save()
      c.fillStyle = '#0088FF'
      roundRectPath(c, M.margin + 30, top - 3, bw, 20, 10)
      c.fill()
      drawText(c, label, { size: 13, weight: 600 }, M.margin + 30 + bw / 2, top + 11.6, '#FFFFFF', 'center')
      c.restore()
    }

    // Avatar — groups without a photo show a cluster of their members, like iOS.
    if (isGroup && !project.chat.avatar && others.length > 1) {
      const members = others.slice(0, 3)
      const spots: [number, number, number][] =
        members.length === 2
          ? [
              [-9.5, -7, 19],
              [9.5, 7, 19],
            ]
          : [
              [0, -12, 15.5],
              [-14, 9, 15.5],
              [14, 9, 15.5],
            ]
      members.forEach((m, i) => {
        const [dx, dy, r] = spots[i]
        const cx = W / 2 + dx
        const cy = top + 30 + dy
        c.save()
        c.fillStyle = P.bg
        circlePath(c, cx, cy, r + 1.5)
        c.fill()
        c.restore()
        drawAvatar(c, cx, cy, r, m.avatar, m.name, m.emoji, m.color)
      })
    } else if (isGroup && !project.chat.avatar) {
      drawAvatar(c, W / 2, top + 30, 30, other?.avatar, title, other?.emoji, other?.color)
    } else {
      drawAvatar(c, W / 2, top + 30, 30, avatarAsset, isGroup ? title : (other?.name ?? ''), project.chat.avatar ? undefined : other?.emoji, other?.color)
    }

    // Title pill
    const font = { size: 17, weight: 600, letterSpacing: 0.235 }
    const name = ellipsize(title, font, W - 160)
    const tw = measureText(name, font)
    const pillW = 14 + tw + 6.5 + 5 + 10.5
    const px = W / 2 - pillW / 2
    const py = top + 55
    glass(c, () => roundRectPath(c, px, py, pillW, 32.33, 16.17))
    drawText(c, name, font, px + 14, py + 22.2, P.titleText)
    // small chevron
    c.save()
    c.strokeStyle = P.titleChevron
    c.lineWidth = 1.7
    c.lineCap = 'round'
    c.lineJoin = 'round'
    const chx = px + 14 + tw + 7.2
    c.beginPath()
    c.moveTo(chx, py + 10.6)
    c.lineTo(chx + 3.5, py + 16.2)
    c.lineTo(chx, py + 21.8)
    c.stroke()
    c.restore()
  }

  // Keyboard visibility 0..1 — follows the iOS keyboard spring when it opens and closes.
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

  /** What's in the composer at time t (my keystrokes, including typos and deletions). */
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

  const fieldMaxLines = 5
  function inputMetrics(t: number) {
    const p = kbProgress(t)
    const kbTop = H - KEYBOARD_HEIGHT * p
    const margin = lerp(28, 16, p)
    const fx = margin + 52
    const fw = W - margin - fx
    const { text, lastKey } = composer(t)
    const textMax = fw - 16 - 52
    const tl = text ? layoutText(text, bodyFont, textMax) : null
    const lines = tl ? Math.min(fieldMaxLines, tl.lines.length) : 1
    const fh = 40.33 + (lines - 1) * 22
    const fy = lerp(H - 28 - fh, H - KEYBOARD_HEIGHT - 16.5 - fh, p)
    return { p, kbTop, margin, fx, fw, fy, fh, text, tl, lines, lastKey }
  }

  function drawCaret(c: Ctx, x: number, y: number, t: number, lastKey: number) {
    const typing = lastKey >= 0 && t - lastKey < 0.55
    if (!typing && Math.floor(t * 1.9) % 2 === 1) return
    c.fillStyle = '#0088FF'
    roundRectPath(c, x, y, 2.2, 21, 1.1)
    c.fill()
  }

  function drawInput(c: Ctx, t: number) {
    const m = inputMetrics(t)
    const focused = m.p > 0.6
    // plus button
    glass(c, () => circlePath(c, m.margin + 20, m.fy + m.fh - 20.17, 20))
    c.save()
    c.strokeStyle = P.icon
    c.lineWidth = 1.75
    c.lineCap = 'round'
    const pcx = m.margin + 20
    const pcy = m.fy + m.fh - 20.17
    c.beginPath()
    c.moveTo(pcx - 6.8, pcy)
    c.lineTo(pcx + 6.8, pcy)
    c.moveTo(pcx, pcy - 6.8)
    c.lineTo(pcx, pcy + 6.8)
    c.stroke()
    c.restore()

    glass(c, () => roundRectPath(c, m.fx, m.fy, m.fw, m.fh, 20.17))
    if (m.text && m.tl) {
      const visible = m.tl.lines.slice(-fieldMaxLines)
      const tl = { ...m.tl, lines: visible }
      drawTextLayout(c, tl, m.fx + 16, m.fy + 25.66, 22, P.incomingText)
      const last = visible[visible.length - 1]
      drawCaret(c, m.fx + 16 + last.width + 1.2, m.fy + 10.2 + (visible.length - 1) * 22, t, m.lastKey)
      // send button
      c.fillStyle = P.send
      const sx = m.fx + m.fw - 6.33 - 38
      const sy = m.fy + m.fh - 20.17 - 14
      roundRectPath(c, sx, sy, 38, 28, 14)
      c.fill()
      c.save()
      c.strokeStyle = '#FFFFFF'
      c.lineWidth = 2.3
      c.lineCap = 'round'
      c.lineJoin = 'round'
      c.beginPath()
      c.moveTo(sx + 19, sy + 21.2)
      c.lineTo(sx + 19, sy + 7.2)
      c.moveTo(sx + 13.2, sy + 12.8)
      c.lineTo(sx + 19, sy + 7)
      c.lineTo(sx + 24.8, sy + 12.8)
      c.stroke()
      c.restore()
    } else {
      const ph = project.chat.service === 'sms' ? strings.placeholderSms : strings.placeholderImessage
      drawText(c, ph, bodyFont, m.fx + 16, m.fy + 25.66, P.placeholder)
      drawMicGlyph(c, m.fx + m.fw - 21, m.fy + 20.6, 17.7, P.mic, 1.55)
      if (focused) drawCaret(c, m.fx + 15, m.fy + 10.2, t, m.lastKey)
    }
    if (m.p > 0.001) {
      const upper = m.text === '' || /[.!?]\s$/.test(m.text)
      drawKeyboard(c, W, m.kbTop, KEYBOARD_HEIGHT, kbColors, locale, t, timeline.keys, upper)
    }
  }

  // ---------- frame ----------
  let lastHits: HitRect[] = []

  return {
    draw(c: Ctx, t: number) {
      c.save()
      c.fillStyle = P.bg
      c.fillRect(0, 0, W, H)

      const im = inputMetrics(t)
      const top = dev.safeTop + M.contentTop
      const viewportBottom = im.fy - 12
      const { placed, bottom } = layoutEntries(entries, t, top)
      const offset = Math.max(0, bottom - viewportBottom)
      const hits: HitRect[] = []
      for (const pl of placed) {
        const y = pl.y - offset
        if (y + pl.h < -60 || y > H + 60) continue
        pl.e.draw(c, y, pl.p, t, hits)
      }
      lastHits = hits

      // Scroll edge effects: content blurs and fades under the header and the input bar.
      const topBand = dev.safeTop + 118
      if (offset > 0) progressiveBlur(c, 0, 0, W, topBand, 'top')
      const edgeTop = c.createLinearGradient(0, 0, 0, topBand)
      edgeTop.addColorStop(0, P.bg)
      edgeTop.addColorStop(0.3, dark ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.92)')
      edgeTop.addColorStop(0.62, dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)')
      edgeTop.addColorStop(1, dark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)')
      c.fillStyle = edgeTop
      c.fillRect(0, 0, W, topBand)
      const eb0 = im.fy - 30
      const ebH = im.kbTop - eb0
      progressiveBlur(c, 0, eb0, W, ebH, 'bottom')
      const edgeBottom = c.createLinearGradient(0, eb0, 0, eb0 + ebH)
      edgeBottom.addColorStop(0, dark ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)')
      edgeBottom.addColorStop(0.55, dark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.75)')
      edgeBottom.addColorStop(1, dark ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.92)')
      c.fillStyle = edgeBottom
      c.fillRect(0, eb0, W, ebH)

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
