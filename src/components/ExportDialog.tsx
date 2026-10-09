import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import type { ExportProgress } from '../lib/export'
import { useStore } from '../lib/store'
import { useT, type UiKey } from '../lib/ui-i18n'
import { Segmented } from './ui'

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; p: ExportProgress }
  | { kind: 'done'; url: string; name: string; size: number; seconds: number }
  | { kind: 'error'; message: string }

const PHASE: Record<ExportProgress['phase'], UiKey> = {
  preparing: 'phasePreparing',
  audio: 'phaseAudio',
  rendering: 'phaseRendering',
  finalizing: 'phaseFinalizing',
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const project = useStore((s) => s.effective)
  const timeline = useStore((s) => s.timeline)
  const update = useStore((s) => s.update)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => () => (status.kind === 'done' ? URL.revokeObjectURL(status.url) : undefined), [status])

  const start = async () => {
    useStore.getState().setPlaying(false)
    abort.current = new AbortController()
    const t0 = performance.now()
    setStatus({ kind: 'running', p: { phase: 'preparing', progress: 0 } })
    try {
      const { exportVideo } = await import('../lib/export')
      const res = await exportVideo(project, timeline, (p) => setStatus({ kind: 'running', p }), abort.current.signal)
      const url = URL.createObjectURL(res.blob)
      const name = `chat-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${res.extension.replace(/^\./, '')}`
      setStatus({ kind: 'done', url, name, size: res.blob.size, seconds: (performance.now() - t0) / 1000 })
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
    } catch (e) {
      if ((e as Error).name === 'AbortError') setStatus({ kind: 'idle' })
      else setStatus({ kind: 'error', message: (e as Error).message || String(e) })
    }
  }

  const running = status.kind === 'running'
  const pct = running ? Math.round((status.p.phase === 'rendering' ? status.p.progress : status.p.phase === 'finalizing' ? 1 : 0) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 font-rounded text-ink backdrop-blur-sm" onClick={() => !running && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        className="pop-in w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl ring-1 ring-ink/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="export-title" className="text-lg font-extrabold">
            🎬 {t('exportTitle')}
          </h2>
          {!running && (
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-ink/40 transition hover:bg-ink/[0.06] hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1.5 text-xs font-semibold text-ink/55">{t('quality')}</div>
              <Segmented
                value={project.resolution}
                onChange={(v) => update((p) => ({ ...p, resolution: v }))}
                options={[
                  { value: 1080, label: '1080p' },
                  { value: 720, label: '720p' },
                ]}
              />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold text-ink/55">{t('frameRate')}</div>
              <Segmented
                value={project.fps}
                onChange={(v) => update((p) => ({ ...p, fps: v }))}
                options={[
                  { value: 30, label: '30 fps' },
                  { value: 60, label: '60 fps' },
                ]}
              />
            </div>
          </div>
          <p className="text-xs text-ink/50">{t('exportInfo', { dur: timeline.duration.toFixed(1) })}</p>

          {status.kind === 'running' && (
            <div className="space-y-1.5">
              <div className="h-2.5 overflow-hidden rounded-full bg-ink/[0.07]">
                <div className="h-full rounded-full bg-honey transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs font-semibold text-ink/55">
                <span>{t(PHASE[status.p.phase])}</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
            </div>
          )}
          {status.kind === 'done' && (
            <div className="rounded-2xl bg-mint p-3 text-sm font-semibold text-[#1E6B34]">
              🎉 {t('doneIn', { s: status.seconds.toFixed(1), mb: (status.size / 1e6).toFixed(1) })}
              <a
                href={status.url}
                download={status.name}
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[#34C759] py-2.5 font-bold text-white transition hover:brightness-105"
              >
                <Download className="h-4 w-4" /> {t('downloadAgain')}
              </a>
            </div>
          )}
          {status.kind === 'error' && <div className="rounded-2xl bg-red-50 p-3 text-xs font-medium text-red-700 ring-1 ring-red-200">{status.message}</div>}

          {running ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-ink/[0.06] py-3 text-sm font-bold transition hover:bg-ink/10"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> {t('cancel')}
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              className="squish flex w-full items-center justify-center gap-2 rounded-full bg-honey py-3 text-sm font-extrabold shadow-[0_10px_24px_-10px_rgba(255,170,0,0.9)]"
            >
              <Download className="h-4 w-4" /> {status.kind === 'done' ? t('exportAgain') : t('exportMp4')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
