import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  type WrappedCanvas,
} from 'mediabunny'
import { createFrameRenderer } from '../render/compose'
import { preloadEmoji } from '../render/emoji'
import { loadFonts } from '../render/fonts'
import { getAssetBlob, loadAssets } from './assets'
import { renderMix } from './audio'
import type { Timeline } from './timeline'
import type { Project } from './types'

export interface ExportProgress {
  phase: 'preparing' | 'audio' | 'rendering' | 'finalizing'
  progress: number
}

export interface ExportResult {
  blob: Blob
  extension: string
  mimeType: string
}

const yieldChannel = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null
/** Yield to the event loop without being throttled in background tabs. */
function yieldToUI(): Promise<void> {
  if (!yieldChannel) return new Promise((r) => setTimeout(r, 0))
  return new Promise((resolve) => {
    yieldChannel.port1.onmessage = () => resolve()
    yieldChannel.port2.postMessage(null)
  })
}

export async function exportVideo(project: Project, timeline: Timeline, onProgress: (p: ExportProgress) => void, signal: AbortSignal): Promise<ExportResult> {
  onProgress({ phase: 'preparing', progress: 0 })
  await loadFonts()
  await loadAssets([
    project.chat.avatar,
    project.background.asset,
    project.sound.music,
    ...timeline.participants.map((p) => p.avatar),
    ...timeline.items.map((i) => i.msg.image ?? null),
  ])
  await preloadEmoji([...timeline.items.map((i) => i.msg.text ?? ''), ...timeline.items.flatMap((i) => i.reactions.map((r) => r.emoji))])

  const renderer = createFrameRenderer(project, timeline)
  const { width, height } = renderer
  const fps = project.fps
  const duration = timeline.duration
  const frames = Math.max(1, Math.ceil(duration * fps))

  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1', 'vp8'], { width, height })
  if (!videoCodec) throw new Error('This browser cannot encode video. Please use the latest Chrome, Edge or Safari.')
  const useMp4 = videoCodec === 'avc' || videoCodec === 'av1'
  const format = useMp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat()
  const audioCodec = await getFirstEncodableAudioCodec(useMp4 ? ['aac', 'opus'] : ['opus', 'vorbis'], {
    numberOfChannels: 2,
    sampleRate: 48000,
  })

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })!

  const output = new Output({ format, target: new BufferTarget() })
  // Chat UIs are mostly flat colour + text: a generous bitrate avoids ghosting after TikTok/Reels re-encode.
  const bitrate = Math.round((project.resolution === 720 ? 5e6 : 10e6) * (fps === 60 ? 1.4 : 1))
  const videoSource = new CanvasSource(canvas, { codec: videoCodec, bitrate, keyFrameInterval: 2 })
  output.addVideoTrack(videoSource, { frameRate: fps })

  const bgBlob = project.background.kind === 'video' ? getAssetBlob(project.background.asset) : null

  let audioSource: AudioBufferSource | null = null
  onProgress({ phase: 'audio', progress: 0 })
  const mix = audioCodec ? await renderMix(project, timeline, frames / fps, bgBlob) : null
  if (mix && audioCodec) {
    audioSource = new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_HIGH })
    output.addAudioTrack(audioSource)
  }

  await output.start()
  if (audioSource && mix) await audioSource.add(mix)

  // Background video frames, decoded frame-accurately and looped.
  let bgIter: AsyncGenerator<WrappedCanvas | null, void, unknown> | null = null
  let bgInput: Input | null = null
  if (bgBlob) {
    try {
      bgInput = new Input({ source: new BlobSource(bgBlob), formats: ALL_FORMATS })
      const track = await bgInput.getPrimaryVideoTrack()
      if (track && (await track.canDecode())) {
        const dur = await track.computeDuration()
        const start = await track.getFirstTimestamp()
        const sink = new CanvasSink(track, { poolSize: 3 })
        const loop = dur - start > 0.05 ? dur - start : 1e9
        function* stamps() {
          for (let i = 0; i < frames; i++) yield start + ((i / fps) % loop)
        }
        bgIter = sink.canvasesAtTimestamps(stamps())
      }
    } catch {
      bgIter = null
    }
  }

  onProgress({ phase: 'rendering', progress: 0 })
  try {
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
      const t = i / fps
      let bg: CanvasImageSource | null = null
      if (bgIter) {
        const r = await bgIter.next()
        bg = r.done ? null : (r.value?.canvas ?? null)
      }
      renderer.draw(ctx, t, bg)
      await videoSource.add(t, 1 / fps)
      if (i % 6 === 0) {
        onProgress({ phase: 'rendering', progress: i / frames })
        await yieldToUI()
      }
    }
    onProgress({ phase: 'finalizing', progress: 1 })
    await output.finalize()
  } catch (e) {
    await output.cancel().catch(() => undefined)
    throw e
  } finally {
    await bgIter?.return?.(undefined)
    bgInput?.dispose?.()
  }

  const buffer = (output.target as BufferTarget).buffer
  if (!buffer) throw new Error('Export produced no data')
  return { blob: new Blob([buffer], { type: format.mimeType }), extension: format.fileExtension, mimeType: format.mimeType }
}

/** Render one frame to a PNG blob. */
export async function exportStill(project: Project, timeline: Timeline, t: number): Promise<Blob> {
  await loadFonts()
  await preloadEmoji(timeline.items.map((i) => i.msg.text ?? ''))
  const renderer = createFrameRenderer(project, timeline)
  const canvas = document.createElement('canvas')
  canvas.width = renderer.width
  canvas.height = renderer.height
  renderer.draw(canvas.getContext('2d')!, t)
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG failed'))), 'image/png'))
}
