import { useEffect, useState } from 'react'
import { BookOpen, Camera, ChevronDown, Download, Link2, Redo2, SlidersHorizontal, Sparkles, Undo2 } from 'lucide-react'
import { AdvancedSettings } from './components/AdvancedSettings'
import { ExportDialog } from './components/ExportDialog'
import { Inspector } from './components/Inspector'
import { MessageList } from './components/MessageList'
import { People } from './components/People'
import { Player } from './components/Player'
import { ScriptEditor } from './components/ScriptEditor'
import { ProjectsModal } from './components/ProjectsModal'
import { ScriptGuide } from './components/ScriptGuide'
import { ShareDialog } from './components/ShareDialog'
import { BRAND, Logo, LogoMark } from './components/Logo'
import { IconButton, Section } from './components/ui'
import { defaultProject, SAMPLES, translateSample } from './lib/defaults'
import { createProject, initProjects } from './lib/projects'
import { flushSave, useStore } from './lib/store'
import { translate as translateUi, useT } from './lib/ui-i18n'
import { useUi } from './lib/ui-store'
import { loadFonts } from './render/fonts'

/** One startup per page load (StrictMode runs effects twice in development). */
let startup: Promise<unknown> | null = null

function LangSwitch() {
  const lang = useUi((s) => s.lang)
  const setLang = useUi((s) => s.setLang)
  const switchTo = (l: 'en' | 'tr') => {
    if (l === lang) return
    // An untouched sample story follows the language.
    const translated = translateSample(useStore.getState().project.script, l)
    if (translated) useStore.getState().loadScript(translated)
    setLang(l)
  }
  return (
    <div className="flex rounded-full bg-ink/[0.06] p-0.5 text-[11px] font-bold">
      {(['en', 'tr'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          className={`rounded-full px-2.5 py-1 uppercase transition ${lang === l ? 'bg-white text-ink shadow-sm' : 'text-ink/45 hover:text-ink'}`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function Editor() {
  const t = useT()
  const [tab, setTab] = useState<'script' | 'messages'>('script')
  const [exporting, setExporting] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const projectMeta = useStore((s) => s.projectMeta)
  const errors = useStore((s) => s.parsed.errors)
  const past = useStore((s) => s.past.length)
  const future = useStore((s) => s.future.length)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const setGuideOpen = useUi((s) => s.setGuideOpen)
  const setAdvancedOpen = useUi((s) => s.setAdvancedOpen)

  useEffect(() => {
    const save = () => void flushSave()
    window.addEventListener('pagehide', save)
    return () => window.removeEventListener('pagehide', save)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('.cm-editor, input, textarea')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const lang = useUi((s) => s.lang)
  const loadScript = useStore((s) => s.loadScript)
  const loadSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id)
    if (s) loadScript(s.script[lang])
  }

  const snapshot = async () => {
    const { effective, timeline, time } = useStore.getState()
    const { exportStill } = await import('./lib/export')
    const blob = await exportStill(effective, timeline, time)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'chat-screenshot.png'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream font-rounded text-ink lg:h-dvh" style={{ colorScheme: 'light' }}>
      <header className="flex h-16 shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <a href="/" title={t('home')} className="flex items-center gap-2">
          <LogoMark className="h-8 w-8 shrink-0" />
          <div className="hidden leading-tight sm:block">
            <Logo className="text-[17px]" markClassName="hidden" />
            <div className="text-[11px] font-medium text-ink/45">{t('tagline')}</div>
          </div>
        </a>
        <button
          type="button"
          onClick={() => setProjectsOpen(true)}
          title={t('projects')}
          className="squish flex max-w-[150px] min-w-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-bold shadow-sm ring-1 ring-ink/10 hover:ring-ink/20 sm:ml-1 sm:max-w-[200px]"
        >
          <span className="truncate">{projectMeta?.name ?? '…'}</span>
          {projectMeta?.share && <Link2 className="h-3.5 w-3.5 shrink-0 text-[#34C759]" />}
          <ChevronDown className="h-4 w-4 shrink-0 text-ink/40" />
        </button>
        <div className="ml-2 hidden items-center gap-1 rounded-full px-2 py-1 transition hover:bg-ink/[0.05] md:flex">
          <Sparkles className="h-4 w-4 text-honey" />
          <select
            value=""
            onChange={(e) => loadSample(e.target.value)}
            className="bg-transparent py-1 text-sm font-semibold text-ink/60 outline-none hover:text-ink"
          >
            <option value="">{t('loadSample')}</option>
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label[lang]}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink/60 transition hover:bg-ink/[0.05] hover:text-ink sm:flex"
          >
            <BookOpen className="h-4 w-4" /> {t('guide')}
          </button>
          <button
            type="button"
            onClick={() => setAdvancedOpen(true)}
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink/60 transition hover:bg-ink/[0.05] hover:text-ink sm:flex"
          >
            <SlidersHorizontal className="h-4 w-4" /> {t('advanced')}
          </button>
          {/* Phones only get the essentials: the rest stays one tap away on bigger screens. */}
          <div className="hidden items-center gap-1 sm:flex">
            <LangSwitch />
            <IconButton title={t('undo')} onClick={undo} disabled={!past}>
              <Undo2 className="h-4 w-4" />
            </IconButton>
            <IconButton title={t('redo')} onClick={redo} disabled={!future}>
              <Redo2 className="h-4 w-4" />
            </IconButton>
            <IconButton title={t('snapshot')} onClick={snapshot}>
              <Camera className="h-4 w-4" />
            </IconButton>
          </div>
          <button
            type="button"
            onClick={() => setSharing(true)}
            title={t('share')}
            className="squish ml-1 flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2.5 text-sm font-bold shadow-sm ring-1 ring-ink/10 hover:ring-ink/20 sm:px-3.5"
          >
            <Link2 className="h-4 w-4" /> <span className="hidden sm:inline">{t('share')}</span>
          </button>
          <button
            type="button"
            onClick={() => setExporting(true)}
            className="squish ml-1 flex shrink-0 items-center gap-2 rounded-full bg-honey px-4 py-2.5 text-sm font-extrabold whitespace-nowrap shadow-[0_10px_24px_-10px_rgba(255,170,0,0.9)] sm:px-5"
          >
            <Download className="h-4 w-4" /> <span className="sm:hidden">{t('export')}</span>
            <span className="hidden sm:inline">{t('exportMp4')}</span>
          </button>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:min-h-0 lg:grid-cols-[380px_minmax(0,1fr)_330px]">
        <aside className="order-2 flex min-h-[520px] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_8px_30px_-18px_rgba(60,40,0,0.35)] ring-1 ring-ink/[0.06] lg:order-1 lg:min-h-0">
          <Section title={t('people')} emoji="👯">
            <People />
          </Section>
          <div className="flex items-center gap-1 border-y border-ink/[0.06] bg-cream/60 px-3 py-2">
            {(['script', 'messages'] as const).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setTab(x)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${tab === x ? 'bg-ink text-white' : 'text-ink/50 hover:text-ink'}`}
              >
                {t(x)}
              </button>
            ))}
            {errors.length > 0 && <span className="ml-2 text-[11px] font-semibold text-red-500">{t('linesNeedName', { n: errors.length })}</span>}
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-ink/55 transition hover:bg-butter hover:text-ink"
            >
              <BookOpen className="h-3.5 w-3.5" /> {t('guide')}
            </button>
          </div>
          <div className="h-[60vh] min-h-0 lg:h-auto lg:flex-1">{tab === 'script' ? <ScriptEditor /> : <MessageList />}</div>
        </aside>

        <section className="relative order-1 flex min-h-[70vh] flex-col overflow-hidden rounded-[28px] p-4 lg:order-2 lg:min-h-0">
          {/* soft pastel glow behind the phone, like the landing page */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
            <div className="absolute top-[8%] left-[12%] h-72 w-72 rounded-full bg-sun/30 blur-3xl" />
            <div className="absolute right-[10%] bottom-[12%] h-80 w-80 rounded-full bg-cloud/70 blur-3xl" />
            <div className="absolute top-[45%] left-[40%] h-64 w-64 rounded-full bg-blush/50 blur-3xl" />
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <Player />
          </div>
        </section>

        <aside className="order-3 overflow-hidden rounded-[28px] bg-white shadow-[0_8px_30px_-18px_rgba(60,40,0,0.35)] ring-1 ring-ink/[0.06] lg:min-h-0 lg:overflow-y-auto">
          <Inspector />
        </aside>
      </main>
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
      {projectsOpen && <ProjectsModal onClose={() => setProjectsOpen(false)} />}
      {sharing && <ShareDialog onClose={() => setSharing(false)} />}
      <AdvancedSettings />
      <ScriptGuide />
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const t = useT()
  useEffect(() => {
    const lang = useUi.getState().lang
    document.documentElement.lang = lang
    const startProjects = async () => {
      const { meta, project } = await initProjects(() => defaultProject(lang), translateUi(lang, 'firstProject'))
      // /app?sample=<id> (from the home page) or /app?new=1 start a fresh project.
      const params = new URLSearchParams(location.search)
      const sample = SAMPLES.find((x) => x.id === params.get('sample'))
      if (sample || params.has('new')) {
        const fresh = { ...defaultProject(lang), script: (sample ?? SAMPLES[0]).script[lang] }
        const m = await createProject(fresh, sample ? sample.label[lang].replace(/^\S+\s/, '') : translateUi(lang, 'untitled'))
        useStore.getState().openProject(m, fresh)
        history.replaceState(null, '', '/app')
      } else {
        useStore.getState().openProject(meta, project)
      }
    }
    startup ??= Promise.all([loadFonts(), startProjects()])
    startup.then(
      () => setState('ready'),
      (e: unknown) => {
        console.error(e)
        setState('failed')
      },
    )
  }, [])
  if (state === 'failed')
    return (
      <div className="grid h-dvh place-items-center bg-cream p-6 text-center font-rounded text-ink">
        <div className="flex max-w-sm flex-col items-center gap-4">
          <LogoMark className="h-11 w-11" />
          <p className="text-sm font-semibold text-ink/60">{t('startupFailed')}</p>
          <button type="button" onClick={() => location.reload()} className="squish rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white">
            {t('tryAgain')}
          </button>
        </div>
      </div>
    )
  if (state === 'loading')
    return (
      <div className="grid h-dvh place-items-center bg-cream font-rounded text-sm font-semibold text-ink/50">
        <div className="flex items-center gap-3">
          <LogoMark className="h-9 w-9" animated /> {t('loading')} {BRAND}…
        </div>
      </div>
    )
  return <Editor />
}
