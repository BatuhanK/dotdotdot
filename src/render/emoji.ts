/*
 * Emoji rendering.
 *
 * On Apple platforms the browser draws Apple Color Emoji natively. Everywhere else we draw the same
 * Apple emoji from PNGs (public/emoji/<codepoints>.png) so exports look identical on every OS.
 */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const RE_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment)
}

export function isEmoji(grapheme: string): boolean {
  return RE_EMOJI.test(grapheme)
}

/** Text consisting only of 1–3 emoji (and whitespace) is shown big without a bubble. */
export function bigEmojiCount(text: string): number {
  const gs = graphemes(text.trim()).filter((g) => g.trim())
  if (!gs.length || gs.length > 3) return 0
  return gs.every(isEmoji) ? gs.length : 0
}

export function emojiKey(grapheme: string): string {
  return Array.from(grapheme)
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((h) => h !== 'fe0f')
    .join('-')
}

function detectNative(): boolean {
  if (typeof navigator === 'undefined') return false
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('emoji') === 'img') return false
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const p = nav.userAgentData?.platform ?? navigator.platform ?? ''
  if (/mac|iphone|ipad|ipod/i.test(p)) return true
  return /Macintosh|iPhone|iPad|iPod/.test(navigator.userAgent)
}

export const nativeEmoji = detectNative()

/* Apple Color Emoji metrics, in em. Measured against native rendering in Safari / Chrome on macOS. */
const IMG_SIZE = 1.0
const IMG_TOP = 0.875

const images = new Map<string, HTMLImageElement | null>()
const pending = new Map<string, Promise<void>>()

function loadImage(key: string): Promise<void> {
  let p = pending.get(key)
  if (p) return p
  p = new Promise<void>((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      images.set(key, img)
      resolve()
    }
    img.onerror = () => {
      images.set(key, null)
      resolve()
    }
    img.src = `/emoji/${key}.webp`
  })
  pending.set(key, p)
  return p
}

/** Make sure every emoji in `texts` is ready to draw (call before exporting). */
export async function preloadEmoji(texts: string[]): Promise<void> {
  if (nativeEmoji) return
  const keys = new Set<string>()
  for (const t of texts) for (const g of graphemes(t)) if (isEmoji(g)) keys.add(emojiKey(g))
  await Promise.all([...keys].map(loadImage))
}

/** Draw one emoji with its pen at (x, baseline). */
export function drawEmoji(ctx: Ctx, grapheme: string, x: number, baseline: number, size: number): void {
  if (!nativeEmoji) {
    const key = emojiKey(grapheme)
    const img = images.get(key)
    if (img) {
      const s = size * IMG_SIZE
      ctx.drawImage(img, x + (size - s) / 2, baseline - size * IMG_TOP, s, s)
      return
    }
    if (img === undefined) void loadImage(key)
  }
  ctx.save()
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D).letterSpacing = '0px'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#000'
  ctx.fillText(grapheme, x, baseline)
  ctx.restore()
}
