import { useEffect, useRef } from 'react'
import { defaultProject } from '../lib/defaults'
import { derive } from '../lib/store'
import type { AppKind, Project } from '../lib/types'
import { createFrameRenderer } from '../render/compose'
import { preloadEmoji } from '../render/emoji'
import { loadFonts } from '../render/fonts'

/**
 * A phone playing a chat script with the real renderer (no video files).
 * When `active` is false it shows the last frame and stops drawing.
 * `app` picks the messenger unless the script sets one with `@app`; `onLoop` fires each time playback starts over.
 */
export function LivePhone({
  script,
  active = true,
  dark = false,
  app,
  onLoop,
  className = '',
}: {
  script: string
  active?: boolean
  dark?: boolean
  app?: AppKind
  onLoop?: () => void
  className?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const visible = useRef(true)
  const loopCb = useRef(onLoop)
  loopCb.current = onLoop

  useEffect(() => {
    const el = canvas.current!
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting), { rootMargin: '100px' })
    io.observe(el)
    let raf = 0
    let stopped = false
    void (async () => {
      await loadFonts()
      const base: Project = {
        ...defaultProject('en'),
        script,
        appearance: dark ? 'dark' : 'light',
        layout: 'fullscreen',
        resolution: 720,
        ...(app ? { app } : {}),
      }
      const { effective, timeline } = derive(base)
      await preloadEmoji(timeline.items.map((i) => i.msg.text ?? ''))
      if (stopped) return
      const r = createFrameRenderer({ ...effective, layout: 'fullscreen', resolution: 720 }, timeline)
      // Draw at the size the phone is shown at, not at 720p: small cards cost a fraction of the pixels.
      const k = Math.min(1, (el.clientWidth * devicePixelRatio) / r.width) || 1
      el.width = Math.round(r.width * k)
      el.height = Math.round(r.height * k)
      const ctx = el.getContext('2d')!
      const draw = (t: number) => {
        ctx.setTransform(k, 0, 0, k, 0, 0)
        r.draw(ctx, t)
      }
      const loop = timeline.duration + 1.2
      if (!active || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        draw(Math.max(0, timeline.duration - 0.3))
        return
      }
      // Playback time only advances while the phone is on screen, so nobody misses the start.
      let played = 0
      let rounds = 0
      let last = performance.now()
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick)
        const dt = Math.min(0.25, (now - last) / 1000)
        if (!visible.current || document.hidden || dt < 0.033) {
          if (dt >= 0.033) last = now
          return
        }
        last = now
        played += dt
        if (Math.floor(played / loop) > rounds) {
          rounds = Math.floor(played / loop)
          loopCb.current?.()
        }
        draw(played % loop)
      }
      raf = requestAnimationFrame(tick)
    })()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [script, active, dark, app])

  return (
    <div className={`relative rounded-[46px] bg-[#111] p-[9px] shadow-[0_30px_60px_-20px_rgba(60,40,0,0.45),inset_0_0_0_2px_#2a2a2a] ${className}`}>
      <div className="relative overflow-hidden rounded-[38px] bg-white">
        <canvas ref={canvas} className="block aspect-[9/16] w-full" />
        <div className="absolute top-[10px] left-1/2 h-[22px] w-[30%] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  )
}
