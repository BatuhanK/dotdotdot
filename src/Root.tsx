import { Component, lazy, Suspense, type ReactNode } from 'react'
import { LogoMark } from './components/Logo'
import { useUi } from './lib/ui-store'

const Landing = lazy(() => import('./landing/Landing'))
const EditorApp = lazy(() => import('./App'))
const SharedView = lazy(() => import('./share/SharedView'))

function Splash() {
  return (
    <div className="grid h-dvh place-items-center bg-cream">
      <LogoMark className="h-11 w-11" animated />
    </div>
  )
}

// Kept here rather than in ui-i18n so the crash screen works without loading anything else.
const CRASH = {
  en: {
    title: 'Something went wrong',
    body: 'The page ran into an unexpected error. Reloading usually fixes it.',
    reload: 'Reload',
    fresh: 'Start a new story',
  },
  tr: {
    title: 'Bir şeyler ters gitti',
    body: 'Sayfa beklenmedik bir hatayla karşılaştı. Yenilemek genelde düzeltir.',
    reload: 'Yenile',
    fresh: 'Yeni hikaye başlat',
  },
}

/** A friendly screen instead of a blank page when rendering throws. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    const c = CRASH[useUi.getState().lang]
    return (
      <div className="grid h-dvh place-items-center bg-cream p-6 text-center font-rounded text-ink">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <h1 className="text-xl font-extrabold">{c.title}</h1>
          <p className="text-sm text-ink/60">{c.body}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => location.reload()} className="squish rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white">
              {c.reload}
            </button>
            <a href="/app?new=1" className="squish rounded-full bg-white px-5 py-2.5 text-sm font-bold ring-1 ring-ink/10">
              {c.fresh}
            </a>
          </div>
        </div>
      </div>
    )
  }
}

/** Tiny path router: / home · /app editor · /s/:id shared story. */
function Page() {
  const path = location.pathname
  if (path === '/app' || path.startsWith('/app/')) return <EditorApp />
  if (path.startsWith('/s/')) return <SharedView id={decodeURIComponent(path.split('/')[2] ?? '')} />
  return <Landing />
}

export function Root() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Splash />}>
        <Page />
      </Suspense>
    </ErrorBoundary>
  )
}
