import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Repeat } from 'lucide-react'
import { assetsVersion, getVideo, loadAssets, onAssetsChange } from '../lib/assets'
import { PreviewAudio } from '../lib/audio'
import { useStore } from '../lib/store'
import { useT } from '../lib/ui-i18n'
import { createFrameRenderer } from '../render/compose'
import { IconButton, rangeFill } from './ui'

function fmt(t: number): string {
  const s = Math.max(0, t)
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`
}

export function Player() {
  const t = useT()
  const project = useStore((s) => s.effective)
  const timeline = useStore((s) => s.timeline)
  const time = useStore((s) => s.time)
  const playing = useStore((s) => s.playing)
  const setTime = useStore((s) => s.setTime)
  const setPlaying = useStore((s) => s.setPlaying)
  const select = useStore((s) => s.select)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audio = useRef<PreviewAudio | null>(null)
  const [assetsV, setAssetsV] = useState(assetsVersion())
  const [loop, setLoop] = useState(false)
  const loopRef = useRef(loop)
  loopRef.current = loop

  useEffect(() => onAssetsChange(() => setAssetsV(assetsVersion())), [])

  useEffect(() => {
    void loadAssets([
      project.chat.avatar,
      project.background.asset,
      ...timeline.participants.map((p) => p.avatar),
      ...timeline.items.map((i) => i.msg.image ?? null),
    ])
  }, [project, timeline])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const renderer = useMemo(() => createFrameRenderer(project, timeline), [project, timeline, assetsV])
  const rendererRef = useRef(renderer)
  rendererRef.current = renderer

  const draw = (t: number) => {
    const c = canvasRef.current
    if (!c) return
    const r = rendererRef.current
    if (c.width !== r.width || c.height !== r.height) {
      c.width = r.width
      c.height = r.height
    }
    r.draw(c.getContext('2d')!, t)
  }

  // Redraw when paused and something changes.
  useEffect(() => {
    if (!playing) draw(time)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, renderer, playing])

  // Keep the background video in sync while paused/scrubbing.
  const bgVideo = project.background.kind === 'video' ? getVideo(project.background.asset) : null
  useEffect(() => {
    if (!bgVideo || playing) return
    const d = bgVideo.duration
    if (d && Number.isFinite(d)) {
      bgVideo.currentTime = time % d
      const redraw = () => draw(useStore.getState().time)
      bgVideo.addEventListener('seeked', redraw, { once: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, bgVideo, playing])

  useEffect(() => {
    if (!playing) return
    if (!audio.current) audio.current = new PreviewAudio()
    const st = useStore.getState()
    const duration = st.timeline.duration
    let from = st.time >= duration - 0.05 ? 0 : st.time
    let start = performance.now()
    void audio.current.start(st.effective, st.timeline, from)
    if (bgVideo && bgVideo.duration) {
      bgVideo.currentTime = from % bgVideo.duration
      void bgVideo.play().catch(() => undefined)
    }
    let raf = 0
    const tick = () => {
      const s = useStore.getState()
      let t = from + (performance.now() - start) / 1000
      if (t >= s.timeline.duration) {
        if (loopRef.current) {
          from = 0
          start = performance.now()
          t = 0
          void audio.current?.start(s.effective, s.timeline, 0)
          if (bgVideo) bgVideo.currentTime = 0
        } else {
          s.setTime(s.timeline.duration)
          s.setPlaying(false)
          return
        }
      }
      draw(t)
      s.setTime(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      audio.current?.stop()
      bgVideo?.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  // Space bar toggles playback.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"], .cm-editor')) return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying(!useStore.getState().playing)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPlaying])

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * c.width
    const py = ((e.clientY - rect.top) / rect.height) * c.height
    const id = renderer.hitTest(px, py)
    if (id) select(id)
  }

  const duration = timeline.duration

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-3">
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          className="h-full max-h-full max-w-full rounded-[22px] bg-black shadow-[0_30px_60px_-24px_rgba(60,40,0,0.45)] ring-1 ring-ink/10"
          style={{ aspectRatio: `${renderer.width} / ${renderer.height}` }}
        />
      </div>
      <div className="flex w-full max-w-[460px] items-center gap-2 rounded-full bg-white px-2 py-1.5 shadow-[0_8px_24px_-14px_rgba(60,40,0,0.45)] ring-1 ring-ink/[0.07]">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-honey text-ink transition hover:bg-sun"
          title={playing ? t('pause') : t('play')}
        >
          {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
        </button>
        <IconButton
          title={t('restart')}
          onClick={() => {
            setPlaying(false)
            setTime(0)
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </IconButton>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={time}
          onChange={(e) => {
            setPlaying(false)
            setTime(parseFloat(e.target.value))
          }}
          className="sweet-range min-w-0 flex-1"
          style={rangeFill(time, 0, duration)}
        />
        <span className="min-w-[92px] shrink-0 text-right font-mono text-[11px] whitespace-nowrap text-ink/50 tabular-nums">
          {fmt(time)} / {fmt(duration)}
        </span>
        <IconButton title={t('loop')} onClick={() => setLoop(!loop)} active={loop}>
          <Repeat className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  )
}
