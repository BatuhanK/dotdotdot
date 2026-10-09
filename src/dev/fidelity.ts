/* Dev-only helpers to render the phone screen at native 3x for comparison with simulator screenshots. */
import { CHAT_STRINGS } from '../lib/i18n'
import { defaultProject } from '../lib/defaults'
import { parseScript } from '../lib/script'
import { compileTimeline, resolveParticipants } from '../lib/timeline'
import type { Project } from '../lib/types'
import { DEVICES } from '../render/devices'
import { createIMessageScene } from '../render/imessage'
import { createWhatsAppScene } from '../render/whatsapp'
import { loadFonts } from '../render/fonts'
import { preloadEmoji } from '../render/emoji'

export const FIXTURES: Record<string, (p: Project) => Project> = {
  ref26: (p) => ({
    ...p,
    script: `Me: Hey! Are you coming tonight?
Me: Yes
Me: Just bring yourself. Maybe some snacks if you want, everyone loves chips
Me: 😂😂
Me: 👍
Me: See you soon`,
    participants: [{ id: 'me', name: 'Me', isMe: true, avatar: null }],
    clock24: true,
    locale: 'en',
    receipts: 'delivered',
    status: { ...p.status, time: '09:41', battery: 100, signal: 4, wifi: true },
    chat: { ...p.chat, title: '+1 (888) 555-1212', clock: '12:28', service: 'sms' },
  }),
}

FIXTURES.e26 = (p) => ({
  ...FIXTURES.ref26(p),
  script: `Me: the one about Mike 💀
Me: 😂😂😂
Me: ok 👍👍 sure
Me: This is a much longer message that should wrap onto several lines so we can check the line height and the width of long texts`,
  chat: { ...FIXTURES.ref26(p).chat, clock: '13:13' },
})

export async function shot(name: string, fixture: string, t?: number, patch?: Partial<Project>): Promise<string> {
  await loadFonts()
  const base = FIXTURES[fixture] ? FIXTURES[fixture](defaultProject()) : defaultProject()
  const project = { ...base, ...patch }
  const parsed = parseScript(project.script)
  const participants = resolveParticipants(project, parsed.names)
  const timeline = compileTimeline(project, parsed.messages, participants)
  await preloadEmoji(parsed.messages.map((m) => m.text ?? ''))
  const dev = DEVICES[project.device]
  const scale = 3
  const scene = createIMessageScene({ project, timeline, device: dev, width: dev.width, height: dev.height, scale, strings: CHAT_STRINGS[project.locale] })
  const canvas = document.createElement('canvas')
  canvas.width = dev.width * scale
  canvas.height = dev.height * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  scene.draw(ctx, t ?? timeline.duration + 5)
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'))
  await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob })
  return `${name} ${canvas.width}x${canvas.height} t=${(t ?? timeline.duration + 5).toFixed(2)}`
}

/** Render a full output frame of the current editor project (optionally patched). */
export async function frame(name: string, t: number, patch?: Partial<Project>): Promise<string> {
  await loadFonts()
  const { useStore } = await import('../lib/store')
  const { createFrameRenderer } = await import('../render/compose')
  const { derive } = await import('../lib/store')
  const { effective: project, timeline } = derive({ ...useStore.getState().project, ...patch })
  const r = createFrameRenderer(project, timeline)
  const canvas = document.createElement('canvas')
  canvas.width = r.width
  canvas.height = r.height
  r.draw(canvas.getContext('2d')!, t)
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'))
  await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob })
  return `${name} dur=${timeline.duration.toFixed(2)}`
}

/** Render a contact sheet of several timestamps side by side (downscaled). */
export async function sheet(name: string, times: number[], patch?: Partial<Project>, scale = 0.33): Promise<string> {
  await loadFonts()
  const { useStore } = await import('../lib/store')
  const { createFrameRenderer } = await import('../render/compose')
  const { derive } = await import('../lib/store')
  const { effective: project, timeline } = derive({ ...useStore.getState().project, ...patch })
  const r = createFrameRenderer(project, timeline)
  const tmp = document.createElement('canvas')
  tmp.width = r.width
  tmp.height = r.height
  const out = document.createElement('canvas')
  const w = Math.round(r.width * scale)
  const h = Math.round(r.height * scale)
  out.width = (w + 8) * times.length
  out.height = h + 30
  const o = out.getContext('2d')!
  o.fillStyle = '#f00'
  o.fillRect(0, 0, out.width, out.height)
  times.forEach((t, i) => {
    r.draw(tmp.getContext('2d')!, t)
    o.drawImage(tmp, i * (w + 8), 30, w, h)
    o.fillStyle = '#fff'
    o.font = '20px sans-serif'
    o.fillText(`t=${t.toFixed(2)}`, i * (w + 8) + 6, 22)
  })
  const blob = await new Promise<Blob>((res) => out.toBlob((b) => res(b!), 'image/png'))
  await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob })
  return `${name} dur=${timeline.duration.toFixed(2)}`
}

/** Render the phone screen (no layout) at 3x for any script — used to compare WhatsApp with the Figma exports. */
export async function screen(name: string, script: string, t?: number, patch?: Partial<Project>): Promise<string> {
  await loadFonts()
  const { derive } = await import('../lib/store')
  const { effective: project, timeline } = derive({ ...defaultProject('en'), ...patch, script })
  await preloadEmoji(timeline.items.map((i) => i.msg.text ?? ''))
  const dev = DEVICES[project.device]
  const scale = 3
  const input = { project, timeline, device: dev, width: dev.width, height: dev.height, scale, strings: CHAT_STRINGS[project.locale] }
  const scene = project.app === 'whatsapp' ? createWhatsAppScene(input) : createIMessageScene(input)
  const canvas = document.createElement('canvas')
  canvas.width = dev.width * scale
  canvas.height = dev.height * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  const at = t ?? timeline.duration + 5
  scene.draw(ctx, at)
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'))
  await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob })
  return `${name} ${canvas.width}x${canvas.height} t=${at.toFixed(2)} dur=${timeline.duration.toFixed(2)}`
}
