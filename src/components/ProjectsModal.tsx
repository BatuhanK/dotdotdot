import { useEffect, useState } from 'react'
import { Copy, Link2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { defaultProject } from '../lib/defaults'
import { createProject, deleteProject, duplicateProject, listProjects, loadProjectById, updateMeta, type ProjectMeta } from '../lib/projects'
import { derive, flushSave, useStore } from '../lib/store'
import { useT } from '../lib/ui-i18n'
import { useUi } from '../lib/ui-store'

function relative(ts: number, lang: string): string {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  const s = (ts - Date.now()) / 1000
  const abs = Math.abs(s)
  if (abs < 60) return rtf.format(Math.round(s), 'second')
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour')
  return rtf.format(Math.round(s / 86400), 'day')
}

export function ProjectsModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const lang = useUi((s) => s.lang)
  const currentId = useStore((s) => s.projectId)
  const [list, setList] = useState<ProjectMeta[]>([])
  const [renaming, setRenaming] = useState<string | null>(null)

  const refresh = async () => setList(await listProjects())
  useEffect(() => {
    let alive = true
    void (async () => {
      await flushSave()
      const metas = await listProjects()
      if (!alive) return
      setList(metas)
      // Projects never edited on this device have no card picture yet: render them now.
      const { renderThumb } = await import('../lib/snapshots')
      for (const m of metas.filter((x) => !x.thumb)) {
        const project = await loadProjectById(m.id)
        if (!project) continue
        const { effective, timeline } = derive(project)
        const thumb = await renderThumb(effective, timeline).catch(() => undefined)
        if (!alive) return
        const next = thumb && (await updateMeta(m.id, { thumb }))
        if (!next) continue
        useStore.getState().setProjectMeta(next)
        setList((l) => l.map((x) => (x.id === next.id ? { ...x, thumb: next.thumb } : x)))
      }
    })()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      alive = false
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = async (meta: ProjectMeta) => {
    await flushSave()
    const project = await loadProjectById(meta.id)
    if (project) useStore.getState().openProject(meta, project)
    onClose()
  }

  const create = async () => {
    await flushSave()
    const n = list.filter((m) => m.name.startsWith(t('untitled'))).length + 1
    const meta = await createProject(defaultProject(lang), n > 1 ? `${t('untitled')} ${n}` : t('untitled'))
    useStore.getState().openProject(meta, defaultProject(lang))
    onClose()
  }

  const remove = async (meta: ProjectMeta) => {
    if (!confirm(t('confirmDelete', { name: meta.name }))) return
    await deleteProject(meta.id)
    const rest = await listProjects()
    if (meta.id === currentId) {
      if (rest.length) await open(rest[0])
      else await create()
      return
    }
    setList(rest)
  }

  const rename = async (meta: ProjectMeta, name: string) => {
    setRenaming(null)
    const clean = name.trim()
    if (!clean || clean === meta.name) return
    const next = await updateMeta(meta.id, { name: clean })
    if (next) useStore.getState().setProjectMeta(next)
    await refresh()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-3 font-rounded text-ink backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="projects-title"
        className="pop-in flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-ink/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink/[0.06] px-6 py-4">
          <div>
            <h2 id="projects-title" className="text-lg font-extrabold">
              🗂️ {t('myProjects')}
            </h2>
            <p className="text-xs text-ink/45">{t('projectsHint')}</p>
          </div>
          <button
            type="button"
            title={t('close')}
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-ink/40 transition hover:bg-ink/[0.06] hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3 md:grid-cols-4">
          <button
            type="button"
            onClick={create}
            className="squish flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-ink/15 bg-cream text-ink/50 transition hover:border-honey hover:bg-butter/60 hover:text-ink"
          >
            <Plus className="h-7 w-7" />
            <span className="text-sm font-bold">{t('newProject')}</span>
          </button>
          {list.map((m) => (
            <div
              key={m.id}
              className={`group relative overflow-hidden rounded-3xl bg-cream ${m.id === currentId ? 'ring-3 ring-honey' : 'ring-1 ring-ink/10'}`}
            >
              <button type="button" onClick={() => open(m)} className="block w-full">
                {m.thumb ? (
                  <img src={m.thumb} alt="" className="aspect-[9/16] w-full object-cover object-bottom transition group-hover:scale-[1.02]" />
                ) : (
                  <div className="aspect-[9/16] w-full bg-gradient-to-b from-butter to-peach" />
                )}
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 via-ink/55 to-transparent p-2.5 pt-8">
                {renaming === m.id ? (
                  <input
                    autoFocus
                    defaultValue={m.name}
                    onBlur={(e) => rename(m, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="w-full rounded-lg bg-white/20 px-1.5 py-0.5 text-sm font-bold text-white outline-none"
                  />
                ) : (
                  <div className="truncate text-sm font-bold text-white">{m.name}</div>
                )}
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/70">
                  {m.share && (
                    <span className="flex items-center gap-0.5 font-bold text-[#7CF29A]">
                      <Link2 className="h-2.5 w-2.5" /> {t('shared')}
                    </span>
                  )}
                  <span className="truncate">{t('edited', { when: relative(m.updatedAt, lang) })}</span>
                </div>
              </div>
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                {[
                  { icon: Pencil, title: t('rename'), fn: () => setRenaming(m.id) },
                  { icon: Copy, title: t('duplicate'), fn: async () => (await duplicateProject(m.id, t('copyOf', { name: m.name })), refresh()) },
                  { icon: Trash2, title: t('deleteProject'), fn: () => remove(m) },
                ].map(({ icon: Icon, title, fn }) => (
                  <button
                    key={title}
                    type="button"
                    title={title}
                    onClick={fn}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur transition hover:bg-white"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
