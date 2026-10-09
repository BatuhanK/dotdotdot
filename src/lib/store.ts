import { create } from 'zustand'
import { defaultProject } from './defaults'
import { saveProject, setCurrentProjectId, updateMeta, type ProjectMeta } from './projects'
import { useUi } from './ui-store'
import { applyScriptSettings } from './presets'
import { activeItemAt, seekTimeFor } from './playhead'
import { parseScript, participantId, type ParseResult } from './script'
import { compileTimeline, resolveParticipants, type Timeline } from './timeline'
import type { Participant, Project } from './types'

interface Derived {
  parsed: ParseResult
  /** Project with the script's @settings applied — this is what gets rendered. */
  effective: Project
  /** @settings keys that override editor settings. */
  applied: string[]
  participants: Participant[]
  timeline: Timeline
}

export function derive(project: Project): Derived {
  const parsed = parseScript(project.script)
  const { project: effective, applied } = applyScriptSettings(project, parsed.settings)
  const participants = resolveParticipants(effective, parsed.names, parsed.settings.me, parsed.avatars)
  const timeline = compileTimeline(effective, parsed.messages, participants)
  return { parsed, effective, applied, participants, timeline }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave: (() => Promise<void>) | null = null
let thumbJob: { id: string; timer: ReturnType<typeof setTimeout> } | null = null

/** Write any pending change right now (before switching projects or leaving the page). */
export async function flushSave(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  const job = pendingSave
  pendingSave = null
  if (job) await job()
}

function scheduleThumb(projectId: string, delay: number) {
  if (thumbJob) clearTimeout(thumbJob.timer)
  thumbJob = { id: projectId, timer: setTimeout(() => void flushThumb(), delay) }
}

/** Render the pending card thumbnail now, from the project that is open at this moment. */
async function flushThumb(): Promise<void> {
  if (!thumbJob) return
  clearTimeout(thumbJob.timer)
  const { id } = thumbJob
  thumbJob = null
  const { projectId, persist, effective, timeline } = useStore.getState()
  if (projectId !== id || !persist) return
  const { renderThumb } = await import('./snapshots')
  const thumb = await renderThumb(effective, timeline).catch(() => undefined)
  if (!thumb) return
  const meta = await updateMeta(id, { thumb })
  if (meta && useStore.getState().projectId === id) useStore.setState({ projectMeta: meta })
}

/** Persist the open project (and refresh its card thumbnail a bit later). */
function scheduleSave(p: Project) {
  const { projectId, persist } = useStore.getState()
  if (!persist || !projectId) return
  if (saveTimer) clearTimeout(saveTimer)
  pendingSave = () => saveProject(projectId, p)
  saveTimer = setTimeout(() => void flushSave(), 400)
  scheduleThumb(projectId, 2500)
}

const HISTORY_LIMIT = 80

interface State extends Derived {
  project: Project
  /** Id of the open local project (null until projects are loaded). */
  projectId: string | null
  projectMeta: ProjectMeta | null
  /** false on shared-project pages: nothing is saved locally. */
  persist: boolean
  /** Open a project: replaces everything without an undo step. */
  openProject: (meta: ProjectMeta | null, project: Project, persist?: boolean) => void
  setProjectMeta: (meta: ProjectMeta) => void
  selectedId: string | null
  time: number
  playing: boolean
  past: Project[]
  future: Project[]
  /** Apply a change to the project. `coalesce` merges rapid edits (typing) into one undo step. */
  update: (fn: (p: Project) => Project, coalesce?: string) => void
  setScript: (script: string) => void
  /** Load a new story: replaces the script and resets playback and per-story chat settings. */
  loadScript: (script: string) => void
  setParticipant: (id: string, patch: Partial<Participant>) => void
  setMe: (id: string) => void
  select: (id: string | null) => void
  /** Select a message and move the video to it (keeps playing if it was playing). */
  jumpTo: (id: string) => void
  /** Move the playhead; the selection follows the message playing at that time. */
  setTime: (t: number) => void
  setPlaying: (p: boolean) => void
  undo: () => void
  redo: () => void
  reset: (p?: Project) => void
}

let lastCoalesce: { key: string; at: number } | null = null

const initial = defaultProject(useUi.getState().lang)

export const useStore = create<State>((set, get) => ({
  project: initial,
  ...derive(initial),
  projectId: null,
  projectMeta: null,
  persist: false,
  selectedId: null,
  time: 0,
  playing: false,
  past: [],
  future: [],

  update(fn, coalesce) {
    const prev = get().project
    const next = fn(prev)
    if (next === prev) return
    const now = performance.now()
    const merge = coalesce && lastCoalesce && lastCoalesce.key === coalesce && now - lastCoalesce.at < 1200
    lastCoalesce = coalesce ? { key: coalesce, at: now } : null
    const past = merge ? get().past : [...get().past, prev].slice(-HISTORY_LIMIT)
    scheduleSave(next)
    const d = derive(next)
    set({ project: next, ...d, past, future: [], time: Math.min(get().time, d.timeline.duration) })
  },

  openProject(meta, project, persist = true) {
    void flushSave()
    void flushThumb()
    if (meta && persist) setCurrentProjectId(meta.id)
    set({
      project,
      ...derive(project),
      projectId: meta?.id ?? null,
      projectMeta: meta,
      persist,
      past: [],
      future: [],
      time: 0,
      playing: false,
      selectedId: null,
    })
    // Projects that were never edited here (first project, remixes) still need a card picture.
    if (meta && persist && !meta.thumb) scheduleThumb(meta.id, 600)
  },

  setProjectMeta(meta) {
    if (meta.id === get().projectId) set({ projectMeta: meta })
  },

  setScript(script) {
    get().update((p) => ({ ...p, script }), 'script')
  },

  loadScript(script) {
    set({ playing: false })
    get().update((p) => ({ ...p, script, chat: { ...p.chat, title: '', avatar: null, group: false } }))
    set({ time: 0, selectedId: null })
  },

  setParticipant(id, patch) {
    get().update((p) => {
      const current = get().participants.find((x) => x.id === id)
      const base: Participant = p.participants.find((x) => x.id === id) ?? current ?? { id, name: id, isMe: false, avatar: null }
      const merged = { ...base, ...patch }
      const list = p.participants.some((x) => x.id === id) ? p.participants.map((x) => (x.id === id ? merged : x)) : [...p.participants, merged]
      return { ...p, participants: list }
    })
  },

  setMe(id) {
    get().update((p) => {
      const all = get().participants
      const list = all.map((x) => {
        const stored = p.participants.find((s) => s.id === x.id) ?? x
        return { ...stored, isMe: x.id === id }
      })
      const rest = p.participants.filter((s) => !list.some((l) => l.id === s.id))
      return { ...p, participants: [...rest, ...list] }
    })
  },

  select(id) {
    set({ selectedId: id })
  },
  jumpTo(id) {
    const item = get().timeline.items.find((i) => i.msg.id === id)
    if (!item) return set({ selectedId: id })
    const wasPlaying = get().playing
    set({ selectedId: id, time: seekTimeFor(item), playing: false })
    // The player reads the time when playback starts, so restart it from the new spot.
    if (wasPlaying) requestAnimationFrame(() => get().setPlaying(true))
  },
  setTime(t) {
    const time = Math.max(0, Math.min(t, get().timeline.duration))
    const active = activeItemAt(get().timeline, time)?.msg.id
    set(active && active !== get().selectedId ? { time, selectedId: active } : { time })
  },
  setPlaying(playing) {
    set({ playing })
  },

  undo() {
    const { past, project, future } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    scheduleSave(prev)
    set({ project: prev, ...derive(prev), past: past.slice(0, -1), future: [project, ...future] })
  },
  redo() {
    const { past, project, future } = get()
    if (!future.length) return
    const next = future[0]
    scheduleSave(next)
    set({ project: next, ...derive(next), past: [...past, project], future: future.slice(1) })
  },
  reset(p) {
    const next = p ?? defaultProject()
    scheduleSave(next)
    set({ project: next, ...derive(next), past: [...get().past, get().project], future: [], time: 0, selectedId: null })
  },
}))

export function participantName(id: string | undefined, list: Participant[]): string {
  if (!id) return ''
  return list.find((p) => p.id === participantId(id))?.name ?? id
}
