import { useEffect, useState } from 'react'
import { Check, Copy, Download, Loader2, Play, Sparkles, Wand2 } from 'lucide-react'
import { ExportDialog } from '../components/ExportDialog'
import { Logo } from '../components/Logo'
import { Player } from '../components/Player'
import { persistAsset } from '../lib/assets'
import { createProject, setCurrentProjectId } from '../lib/projects'
import { fetchShare, loadShareAssets, ShareError, type SharedProject } from '../lib/share'
import { useStore } from '../lib/store'
import { useT } from '../lib/ui-i18n'
import { useUi } from '../lib/ui-store'
import { loadFonts } from '../render/fonts'

export default function SharedView({ id }: { id: string }) {
  const t = useT()
  const lang = useUi((s) => s.lang)
  const setLang = useUi((s) => s.setLang)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [shared, setShared] = useState<SharedProject | null>(null)
  const [progress, setProgress] = useState('')
  const [exporting, setExporting] = useState(false)
  const [remixing, setRemixing] = useState(false)
  const [copied, setCopied] = useState(false)
  const playing = useStore((s) => s.playing)
  const [started, setStarted] = useState(false)
  if (playing && !started) setStarted(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await loadFonts()
        const s = await fetchShare(id)
        if (cancelled) return
        useStore.getState().openProject(null, s.project, false)
        await loadShareAssets(s, false, (d, n) => n && setProgress(`${d}/${n}`))
        if (cancelled) return
        setShared(s)
        setState('ready')
        if (s.title) document.title = `${s.title} · dotdotdot`
      } catch (e) {
        // A deleted story and a network problem need different messages.
        if (!cancelled) setState(e instanceof ShareError && e.status === 404 ? 'missing' : 'failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  const remix = async () => {
    if (!shared) return
    setRemixing(true)
    try {
      await Promise.all(shared.assets.filter((a) => a.id !== 'thumb').map((a) => persistAsset(a.id)))
      const meta = await createProject(shared.project, shared.title || t('untitled'))
      setCurrentProjectId(meta.id)
      location.href = '/app'
    } catch (e) {
      console.error(e)
      setRemixing(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#FFFBF1] font-rounded text-[#1A1200]">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4">
        <a href="/" aria-label="dotdotdot">
          <Logo className="text-lg" />
        </a>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-full bg-black/[0.05] p-0.5 text-xs font-semibold">
            {(['en', 'tr'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`rounded-full px-2.5 py-1 uppercase ${lang === l ? 'bg-white shadow-sm' : 'text-black/50'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <a href="/app?new=1" className="squish rounded-full bg-[#1A1200] px-4 py-2 text-sm font-bold text-white">
            {t('makeYourOwn')}
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center px-5 pb-16">
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-32 text-black/50">
            <Loader2 className="h-7 w-7 animate-spin" />
            <span className="text-sm font-semibold">
              {t('loadingStory')} {progress}
            </span>
          </div>
        )}
        {state === 'missing' && (
          <div className="flex flex-col items-center gap-4 py-32 text-center">
            <div className="text-6xl">🫥</div>
            <p className="text-lg font-bold">{t('notFound')}</p>
            <a href="/app?new=1" className="squish rounded-full bg-[#FFB800] px-6 py-3 font-bold">
              {t('makeYourOwn')}
            </a>
          </div>
        )}
        {state === 'failed' && (
          <div className="flex flex-col items-center gap-4 py-32 text-center">
            <div className="text-6xl">📡</div>
            <p className="max-w-sm text-lg font-bold">{t('loadStoryFailed')}</p>
            <button
              type="button"
              onClick={() => {
                setState('loading')
                setAttempt((n) => n + 1)
              }}
              className="squish rounded-full bg-[#FFB800] px-6 py-3 font-bold"
            >
              {t('tryAgain')}
            </button>
          </div>
        )}
        {state === 'ready' && shared && (
          <>
            <h1 className="pop-in mb-1 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">{shared.title || t('madeWith')}</h1>
            <p className="mb-5 flex items-center gap-1.5 text-sm font-semibold text-black/45">
              <Sparkles className="h-4 w-4 text-[#FFB000]" /> {t('madeWith')}
            </p>
            <div className="relative h-[72dvh] w-full max-w-[460px]">
              <Player />
              {!started && (
                // Big play button over the phone until the first play (the tap also unlocks sound).
                <button
                  type="button"
                  aria-label={t('play')}
                  onClick={() => useStore.getState().setPlaying(true)}
                  className="absolute inset-x-0 top-0 bottom-[62px] grid place-items-center"
                >
                  <span className="squish grid h-20 w-20 place-items-center rounded-full bg-[#FFB800] text-[#1A1200] shadow-[0_12px_32px_-8px_rgba(255,170,0,0.8)]">
                    <Play className="ml-1 h-9 w-9" fill="currentColor" />
                  </span>
                </button>
              )}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={remix}
                disabled={remixing}
                className="squish flex items-center gap-2 rounded-full bg-[#FFB800] px-6 py-3 font-bold shadow-[0_8px_24px_-8px_rgba(255,170,0,0.7)]"
              >
                {remixing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />} {t('remix')}
              </button>
              <button
                type="button"
                onClick={() => setExporting(true)}
                className="squish flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold shadow-sm ring-1 ring-black/10"
              >
                <Download className="h-5 w-5" /> {t('downloadMp4')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(location.href)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
                className="squish flex items-center gap-2 rounded-full bg-white px-5 py-3 font-bold shadow-sm ring-1 ring-black/10"
              >
                {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />} {copied ? t('copied') : t('copyLink')}
              </button>
            </div>
          </>
        )}
      </main>
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
    </div>
  )
}
