import { loadWhatsAppAssets } from './wa-assets'

export const FONT_TEXT = 'SF Pro Text'
export const FONT_DISPLAY = 'SF Pro Display'

const FACES: [family: string, weight: number, file: string][] = [
  [FONT_TEXT, 400, 'SFProText-Regular'],
  [FONT_TEXT, 500, 'SFProText-Medium'],
  [FONT_TEXT, 600, 'SFProText-Semibold'],
  [FONT_TEXT, 700, 'SFProText-Bold'],
  [FONT_DISPLAY, 400, 'SFProDisplay-Regular'],
  [FONT_DISPLAY, 500, 'SFProDisplay-Medium'],
  [FONT_DISPLAY, 600, 'SFProDisplay-Semibold'],
  [FONT_DISPLAY, 700, 'SFProDisplay-Bold'],
]

let loading: Promise<void> | null = null

/** Fonts (and the other static images the phone screens need) — everything a frame can draw. */
export function loadFonts(): Promise<void> {
  if (!loading) {
    // A font that fails to load (offline, blocked) falls back to the system font instead of stopping the app.
    loading = Promise.allSettled([
      loadWhatsAppAssets(),
      ...FACES.map(async ([family, weight, file]) => {
        const face = new FontFace(family, `url(/fonts/${file}.woff2) format('woff2')`, {
          weight: String(weight),
          style: 'normal',
        })
        await face.load()
        document.fonts.add(face)
      }),
    ]).then((results) => {
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed) console.warn(`${failed} font(s) failed to load; using fallback fonts`)
    })
  }
  return loading
}

/*
 * Tracking values from the `trak` table of SF Pro (track 0), in font units (2048 upm) per glyph.
 * CoreText applies these automatically on iOS; browsers don't, so we apply them as letter-spacing.
 */
const TRAK_TEXT: [number, number][] = [
  [6, 82],
  [9, 38],
  [10, 24],
  [11, 12],
  [12, 0],
  [13, -12],
  [14, -22],
  [15, -32],
  [16, -40],
  [17, -47],
  [20, -55],
  [22, -60],
  [28, -66],
  [32, -68],
  [36, -70],
  [50, -78],
  [64, -86],
  [80, -92],
  [138, -92],
]
const TRAK_DISPLAY: [number, number][] = [
  [6, 174],
  [9, 130],
  [10, 116],
  [11, 104],
  [12, 92],
  [13, 80],
  [14, 70],
  [15, 60],
  [16, 52],
  [17, 45],
  [20, 37],
  [22, 32],
  [28, 26],
  [32, 24],
  [36, 22],
  [50, 14],
  [64, 6],
  [80, 0],
  [138, 0],
]

function interp(table: [number, number][], size: number): number {
  if (size <= table[0][0]) return table[0][1]
  for (let i = 1; i < table.length; i++) {
    const [s1, v1] = table[i]
    if (size <= s1) {
      const [s0, v0] = table[i - 1]
      return v0 + ((v1 - v0) * (size - s0)) / (s1 - s0)
    }
  }
  return table[table.length - 1][1]
}

export function isDisplaySize(size: number): boolean {
  return size >= 20
}

/** Letter spacing in the same unit as `size`. */
export function tracking(size: number): number {
  const units = interp(isDisplaySize(size) ? TRAK_DISPLAY : TRAK_TEXT, size)
  // iOS 26 sets body text ~0.065pt tighter than the static font's trak table (measured at 17pt).
  const correction = size >= 14 && size < 20 ? -0.065 * (size / 17) : 0
  return (units / 2048) * size + correction
}

export interface FontStyle {
  size: number
  weight?: number
  /** Override the automatic Text/Display switch. */
  family?: string
  /** Extra letter spacing on top of the automatic tracking. */
  letterSpacing?: number
  /** Disable SF tracking (e.g. for non-Apple UI like WhatsApp Android). */
  noTracking?: boolean
}

export function fontString(s: FontStyle): string {
  const family = s.family ?? (isDisplaySize(s.size) ? FONT_DISPLAY : FONT_TEXT)
  return `${s.weight ?? 400} ${s.size}px "${family}", "SF Pro Text", -apple-system, "Helvetica Neue", Arial, sans-serif`
}

export function spacingOf(s: FontStyle): number {
  return (s.noTracking ? 0 : tracking(s.size)) + (s.letterSpacing ?? 0)
}

const hasLetterSpacing = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype

export function applyFont(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, s: FontStyle): void {
  ctx.font = fontString(s)
  if (hasLetterSpacing) (ctx as CanvasRenderingContext2D).letterSpacing = `${spacingOf(s)}px`
}

export function resetSpacing(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
  if (hasLetterSpacing) (ctx as CanvasRenderingContext2D).letterSpacing = '0px'
}
