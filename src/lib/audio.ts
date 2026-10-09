import { getAssetBlob } from './assets'
import type { SoundId, Timeline } from './timeline'
import type { Project } from './types'

const FILES: Record<SoundId, string> = {
  'imessage-send': '/sounds/imessage-send.wav',
  'imessage-receive': '/sounds/imessage-receive.wav',
  'whatsapp-send': '/sounds/whatsapp-send.wav',
  'whatsapp-receive': '/sounds/whatsapp-receive.wav',
  'key-click': '/sounds/key-click.wav',
  'key-delete': '/sounds/key-delete.wav',
  tapback: '/sounds/tapback-receive.wav',
}

const GAIN: Record<SoundId, number> = {
  'imessage-send': 0.9,
  'imessage-receive': 0.9,
  'whatsapp-send': 0.9,
  'whatsapp-receive': 0.9,
  'key-click': 0.55,
  'key-delete': 0.55,
  tapback: 0.75,
}

const raw = new Map<string, Promise<ArrayBuffer>>()
const decoded = new Map<string, AudioBuffer>()

function fetchRaw(url: string): Promise<ArrayBuffer> {
  let p = raw.get(url)
  if (!p) {
    p = fetch(url).then((r) => r.arrayBuffer())
    raw.set(url, p)
  }
  return p
}

async function decode(ctx: BaseAudioContext, key: string, data: () => Promise<ArrayBuffer>): Promise<AudioBuffer | null> {
  const cached = decoded.get(key)
  if (cached) return cached
  try {
    const buf = await ctx.decodeAudioData((await data()).slice(0))
    decoded.set(key, buf)
    return buf
  } catch {
    return null
  }
}

async function soundBuffers(ctx: BaseAudioContext, ids: Set<SoundId>): Promise<Map<SoundId, AudioBuffer>> {
  const out = new Map<SoundId, AudioBuffer>()
  await Promise.all(
    [...ids].map(async (id) => {
      const b = await decode(ctx, FILES[id], () => fetchRaw(FILES[id]))
      if (b) out.set(id, b)
    }),
  )
  return out
}

async function assetBuffer(ctx: BaseAudioContext, id: string | null | undefined): Promise<AudioBuffer | null> {
  if (!id) return null
  const blob = getAssetBlob(id)
  if (!blob) return null
  return decode(ctx, `asset:${id}`, () => blob.arrayBuffer())
}

/** Live preview audio: schedules every sound after `from` relative to now. */
export class PreviewAudio {
  private ctx: AudioContext | null = null
  private nodes: AudioScheduledSourceNode[] = []

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext({ latencyHint: 'interactive' })
    return this.ctx
  }

  async warmup(project: Project, timeline: Timeline): Promise<void> {
    const ctx = this.context()
    await soundBuffers(ctx, new Set(timeline.sounds.map((s) => s.id)))
    await assetBuffer(ctx, project.sound.music)
  }

  async start(project: Project, timeline: Timeline, from: number): Promise<void> {
    this.stop()
    if (!project.sound.enabled) return
    const ctx = this.context()
    if (ctx.state !== 'running') await ctx.resume()
    const buffers = await soundBuffers(ctx, new Set(timeline.sounds.map((s) => s.id)))
    const master = ctx.createGain()
    master.gain.value = project.sound.volume
    master.connect(ctx.destination)
    const t0 = ctx.currentTime + 0.03
    for (const s of timeline.sounds) {
      if (s.at < from - 0.01) continue
      const buf = buffers.get(s.id)
      if (!buf) continue
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = ctx.createGain()
      g.gain.value = GAIN[s.id]
      src.connect(g).connect(master)
      src.start(t0 + (s.at - from))
      this.nodes.push(src)
    }
    const music = await assetBuffer(ctx, project.sound.music)
    if (music) {
      const src = ctx.createBufferSource()
      src.buffer = music
      src.loop = true
      const g = ctx.createGain()
      g.gain.value = project.sound.musicVolume
      src.connect(g).connect(master)
      src.start(t0, from % music.duration)
      this.nodes.push(src)
    }
  }

  stop(): void {
    for (const n of this.nodes) {
      try {
        n.stop()
      } catch {
        /* already stopped */
      }
    }
    this.nodes = []
  }
}

/** Render the whole soundtrack offline for export. */
export async function renderMix(project: Project, timeline: Timeline, duration: number, videoBlob: Blob | null): Promise<AudioBuffer | null> {
  const rate = 48000
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * rate), rate)
  const master = ctx.createGain()
  master.gain.value = project.sound.volume
  master.connect(ctx.destination)
  let any = false

  if (project.sound.enabled) {
    const buffers = await soundBuffers(ctx, new Set(timeline.sounds.map((s) => s.id)))
    for (const s of timeline.sounds) {
      const buf = buffers.get(s.id)
      if (!buf || s.at >= duration) continue
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = ctx.createGain()
      g.gain.value = GAIN[s.id]
      src.connect(g).connect(master)
      src.start(s.at)
      any = true
    }
  }
  const music = await assetBuffer(ctx, project.sound.music)
  if (music) {
    const src = ctx.createBufferSource()
    src.buffer = music
    src.loop = true
    const g = ctx.createGain()
    g.gain.value = project.sound.musicVolume
    src.connect(g).connect(master)
    src.start(0)
    any = true
  }
  if (videoBlob && project.sound.videoAudio) {
    try {
      const vbuf = await ctx.decodeAudioData(await videoBlob.arrayBuffer())
      const src = ctx.createBufferSource()
      src.buffer = vbuf
      src.loop = true
      src.connect(master)
      src.start(0)
      any = true
    } catch {
      /* video has no decodable audio */
    }
  }
  if (!any) return null
  return ctx.startRendering()
}
