import { applyFont, type FontStyle } from './fonts'
import { drawEmoji, graphemes, isEmoji } from './emoji'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface Frag {
  text: string
  x: number
  width: number
  emoji: boolean
}

export interface Line {
  frags: Frag[]
  width: number
  /** Width of the whitespace the line was wrapped at (UIKit counts it in the bubble width). */
  trailing: number
}

export interface TextLayout {
  lines: Line[]
  /** Width of the widest line. */
  width: number
  style: FontStyle
  /** Emoji are drawn at this size (defaults to the font size). */
  emojiSize: number
  /** Vertical offset of inline emoji below the baseline (defaults to 12% of the font size, iOS Messages). */
  emojiDy?: number
}

let measureCtx: Ctx | null = null
function mctx(): Ctx {
  if (!measureCtx) {
    measureCtx = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(8, 8).getContext('2d')! : document.createElement('canvas').getContext('2d')!
  }
  return measureCtx
}

const widthCache = new Map<string, number>()

function styleKey(s: FontStyle): string {
  return `${s.size}|${s.weight ?? 400}|${s.family ?? ''}|${s.letterSpacing ?? 0}|${s.noTracking ? 1 : 0}`
}

export function measureText(text: string, style: FontStyle): number {
  const key = `${styleKey(style)}|${text}`
  let w = widthCache.get(key)
  if (w === undefined) {
    const ctx = mctx()
    applyFont(ctx, style)
    w = ctx.measureText(text).width
    widthCache.set(key, w)
  }
  return w
}

/** Emoji advance: Apple Color Emoji glyphs are exactly 1em wide. */
export function emojiAdvance(_grapheme: string, size: number): number {
  return size
}

/** UIKit draws emoji inside text ~1.37× larger than the surrounding font (measured on iOS 26). */
export const INLINE_EMOJI_SCALE = 1.368

export function clearTextCache(): void {
  widthCache.clear()
}

interface Token {
  text: string
  width: number
  space: boolean
  emoji: boolean
}

const wordSeg = new Intl.Segmenter(undefined, { granularity: 'word' })

function tokenize(paragraph: string, style: FontStyle, emojiSize: number): Token[] {
  const out: Token[] = []
  for (const { segment } of wordSeg.segment(paragraph)) {
    if (/^\s+$/.test(segment)) {
      out.push({ text: segment, width: measureText(segment, style), space: true, emoji: false })
      continue
    }
    let buf = ''
    const flush = () => {
      if (buf) out.push({ text: buf, width: measureText(buf, style), space: false, emoji: false })
      buf = ''
    }
    for (const g of graphemes(segment)) {
      if (isEmoji(g)) {
        flush()
        out.push({ text: g, width: emojiAdvance(g, emojiSize), space: false, emoji: true })
      } else buf += g
    }
    flush()
  }
  return out
}

function splitLongToken(tok: Token, style: FontStyle, maxWidth: number): Token[] {
  const parts: Token[] = []
  let buf = ''
  for (const g of graphemes(tok.text)) {
    const next = buf + g
    if (buf && measureText(next, style) > maxWidth) {
      parts.push({ text: buf, width: measureText(buf, style), space: false, emoji: false })
      buf = g
    } else buf = next
  }
  if (buf) parts.push({ text: buf, width: measureText(buf, style), space: false, emoji: false })
  return parts
}

/** Lay out text into lines no wider than maxWidth (greedy, like UIKit's word wrapping). */
export function layoutText(text: string, style: FontStyle, maxWidth: number, emojiSize = style.size * INLINE_EMOJI_SCALE): TextLayout {
  const lines: Line[] = []
  for (const paragraph of text.split('\n')) {
    let cur: Token[] = []
    let curWidth = 0
    const push = (wrapped = false) => {
      let trailing = 0
      while (cur.length && cur[cur.length - 1].space) trailing += cur.pop()!.width
      const line = buildLine(cur, style)
      line.trailing = wrapped ? trailing : 0
      lines.push(line)
      cur = []
      curWidth = 0
    }
    const tokens = tokenize(paragraph, style, emojiSize)
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]
      if (tok.space) {
        if (cur.length) {
          cur.push(tok)
          curWidth += tok.width
        }
        continue
      }
      if (curWidth + tok.width <= maxWidth + 0.01 || !cur.length) {
        if (!cur.length && tok.width > maxWidth && !tok.emoji) {
          const parts = splitLongToken(tok, style, maxWidth)
          parts.forEach((p, idx) => {
            cur.push(p)
            curWidth += p.width
            if (idx < parts.length - 1) push(true)
          })
          continue
        }
        cur.push(tok)
        curWidth += tok.width
      } else {
        push(true)
        i--
      }
    }
    push()
  }
  return { lines, width: Math.max(0, ...lines.map((l) => l.width + l.trailing)), style, emojiSize }
}

function buildLine(tokens: Token[], style: FontStyle): Line {
  const frags: Frag[] = []
  let x = 0
  let buf = ''
  const flush = () => {
    if (!buf) return
    const w = measureText(buf, style)
    frags.push({ text: buf, x, width: w, emoji: false })
    x += w
    buf = ''
  }
  for (const t of tokens) {
    if (t.emoji) {
      flush()
      frags.push({ text: t.text, x, width: t.width, emoji: true })
      x += t.width
    } else buf += t.text
  }
  flush()
  return { frags, width: x, trailing: 0 }
}

/** Draw a laid out text block. `baseline` is the first line's baseline. */
export function drawTextLayout(
  ctx: Ctx,
  layout: TextLayout,
  x: number,
  baseline: number,
  lineHeight: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
  boxWidth = layout.width,
): void {
  applyFont(ctx, layout.style)
  ctx.fillStyle = color
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  layout.lines.forEach((line, i) => {
    const off = align === 'left' ? 0 : align === 'center' ? (boxWidth - line.width) / 2 : boxWidth - line.width
    const by = baseline + i * lineHeight
    for (const f of line.frags) {
      if (f.emoji) {
        if (layout.emojiSize > layout.style.size * 2) {
          drawEmoji(ctx, f.text, x + off + f.x, by, layout.emojiSize)
        } else {
          // Inline emoji: glyph is ~94% of its advance and sits slightly below the baseline.
          const s = layout.emojiSize * 0.94
          drawEmoji(ctx, f.text, x + off + f.x + (layout.emojiSize - s) / 2, by + (layout.emojiDy ?? layout.style.size * 0.12), s)
        }
        applyFont(ctx, layout.style)
        ctx.fillStyle = color
      } else ctx.fillText(f.text, x + off + f.x, by)
    }
  })
}

/** Single-line text helper. */
export function drawText(
  ctx: Ctx,
  text: string,
  style: FontStyle,
  x: number,
  baseline: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
): number {
  const layout = layoutText(text, style, 1e6)
  const w = layout.width
  const left = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w
  drawTextLayout(ctx, layout, left, baseline, 0, color, 'left')
  return w
}

/** Truncate text with an ellipsis so it fits maxWidth. */
export function ellipsize(text: string, style: FontStyle, maxWidth: number): string {
  if (measureText(text, style) <= maxWidth) return text
  const gs = graphemes(text)
  let lo = 0
  let hi = gs.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measureText(gs.slice(0, mid).join('') + '…', style) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return gs.slice(0, lo).join('').trimEnd() + '…'
}
