import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Link2, Loader2, X } from 'lucide-react'
import { updateMeta } from '../lib/projects'
import { publishProject, ShareError, shareUrl, unpublish, type PublishProgress } from '../lib/share'
import { flushSave, useStore } from '../lib/store'
import { useT } from '../lib/ui-i18n'
import { inputCls } from './ui'

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const meta = useStore((s) => s.projectMeta)
  const [title, setTitle] = useState(meta?.name ?? '')
  const [busy, setBusy] = useState<PublishProgress | 'stopping' | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  if (!meta) return null
  const share = meta.share
  const url = share ? shareUrl(share.id) : ''
  const outdated = !!share && meta.updatedAt > share.sharedAt + 1500

  const publish = async () => {
    setError('')
    setBusy({ step: 'preparing', done: 0, total: 0 })
    try {
      await flushSave()
      const project = useStore.getState().project
      const next = await publishProject(meta, project, title.trim() || meta.name, setBusy)
      const m = await updateMeta(meta.id, { share: next, name: title.trim() || meta.name })
      if (m) useStore.getState().setProjectMeta(m)
    } catch (e) {
      setError(explain(e))
    } finally {
      setBusy(null)
    }
  }

  const stop = async () => {
    if (!share) return
    setBusy('stopping')
    try {
      await unpublish(share)
      const m = await updateMeta(meta.id, { share: undefined })
      if (m) useStore.getState().setProjectMeta(m)
    } catch (e) {
      setError(explain(e))
    } finally {
      setBusy(null)
    }
  }

  const explain = (e: unknown): string => {
    if (e instanceof ShareError) {
      if (e.code === 'quota_exceeded') return t('shareQuota')
      if (e.code === 'rate_limited' || e.status === 429) return t('shareRateLimited')
      if (e.code === 'too_large' || e.status === 413) return t('shareTooBig')
      if (e.code === 'unsupported_media' || e.status === 415) return t('shareUnsupported')
      return e.message
    }
    // fetch() rejects with a TypeError when the network is down.
    return e instanceof TypeError ? t('shareOffline') : (e as Error).message
  }

  const progressLabel =
    busy && busy !== 'stopping' ? (busy.step === 'preparing' ? t('preparingShare') : t('uploading', { done: busy.done, total: busy.total })) : ''

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 font-rounded text-ink backdrop-blur-sm" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="pop-in w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl ring-1 ring-ink/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="share-title" className="flex items-center gap-2 text-lg font-extrabold">
            🔗 {t('shareTitle')}
          </h2>
          {!busy && (
            <button
              type="button"
              title={t('close')}
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full text-ink/40 transition hover:bg-ink/[0.06] hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mb-4 text-[13px] leading-relaxed text-ink/60">{t('shareInfo')}</p>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-xs font-semibold text-ink/55">{t('shareName')}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className={inputCls} />
        </label>

        {share && (
          <div className="mb-4 rounded-3xl bg-mint p-3.5">
            <div className="mb-2 text-xs font-bold text-[#1E6B34]">🎉 {t('linkReady')}</div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 rounded-full bg-white px-3 py-2 font-mono text-xs text-ink outline-none ring-1 ring-ink/10"
              />
              <button
                type="button"
                title={t('copyLink')}
                onClick={async () => {
                  await navigator.clipboard.writeText(url)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#34C759] text-white transition hover:brightness-105"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                title={t('open')}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white ring-1 ring-ink/10 transition hover:ring-ink/25"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            {outdated && <p className="mt-2 text-[11px] font-semibold text-[#8A4B00]">{t('shareOutdated')}</p>}
          </div>
        )}

        {error && <div className="mb-3 rounded-2xl bg-red-50 p-3 text-xs font-medium text-red-700 ring-1 ring-red-200">{error}</div>}

        <div className="flex items-center gap-2">
          {share && (
            <button
              type="button"
              disabled={!!busy}
              onClick={stop}
              className="rounded-full px-3 py-2.5 text-xs font-bold text-ink/45 transition hover:text-red-600 disabled:opacity-40"
            >
              {busy === 'stopping' ? <Loader2 className="h-4 w-4 animate-spin" /> : t('stopSharing')}
            </button>
          )}
          <button
            type="button"
            disabled={!!busy}
            onClick={publish}
            className="squish ml-auto flex items-center gap-2 rounded-full bg-honey px-5 py-3 text-sm font-extrabold shadow-[0_10px_24px_-10px_rgba(255,170,0,0.9)] disabled:opacity-60"
          >
            {busy && busy !== 'stopping' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {busy && busy !== 'stopping' ? progressLabel : share ? t('updateLink') : t('createLink')}
          </button>
        </div>
      </div>
    </div>
  )
}
