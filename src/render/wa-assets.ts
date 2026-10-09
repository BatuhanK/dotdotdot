/*
 * Images for the WhatsApp screen. The light wallpaper is WhatsApp's default doodle (exported from the
 * Figma reference); the dark one is derived from it: same doodles, slightly lighter than the dark base.
 */

type Source = HTMLImageElement | HTMLCanvasElement | OffscreenCanvas

const LIGHT_BASE = [245, 242, 235]
const DARK_BASE = [11, 20, 26]

export const waWallpaper: { light: Source | null; dark: Source | null } = { light: null, dark: null }

let loading: Promise<void> | null = null

function darken(img: HTMLImageElement): Source | null {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h })
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    // How far the doodle line is from the paper colour (0 … ~30), turned into a lighter line on dark.
    const depth = Math.max(0, (LIGHT_BASE[0] - px[i] + LIGHT_BASE[1] - px[i + 1] + LIGHT_BASE[2] - px[i + 2]) / 3)
    const k = depth * 0.85
    px[i] = DARK_BASE[0] + k
    px[i + 1] = DARK_BASE[1] + k * 1.05
    px[i + 2] = DARK_BASE[2] + k * 1.1
  }
  ctx.putImageData(data, 0, 0)
  return canvas
}

/** Load the wallpapers once (cheap: one 85 KB image). */
export function loadWhatsAppAssets(): Promise<void> {
  if (loading) return loading
  loading = new Promise<void>((resolve) => {
    if (typeof Image === 'undefined') return resolve()
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      waWallpaper.light = img
      try {
        waWallpaper.dark = darken(img)
      } catch {
        waWallpaper.dark = null
      }
      resolve()
    }
    img.onerror = () => resolve()
    img.src = '/wa/wallpaper.webp'
  })
  return loading
}
