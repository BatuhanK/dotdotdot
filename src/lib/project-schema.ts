/*
 * Checks for projects that come from outside the editor: shared links (checked by the Worker before it
 * stores them, and again by the app before it renders them) and projects saved by older versions.
 * Every field is type-checked, enums are whitelisted and numbers clamped, so a hand-made project can't
 * crash the renderer or ask for an hours-long export. No DOM access: the Worker imports this file.
 */
import type { AppKind, Appearance, BackgroundKind, ChatLocale, DeviceId, KeyboardMode, LayoutKind, Participant, Project, ReceiptMode, Timing } from './types'

/** Hard limits for anything a script or a shared project can ask for. */
export const LIMITS = {
  scriptChars: 200_000,
  participants: 100,
  /** Longest single <wait>, <typing>, <pause>, <hold> … in a script, seconds. */
  directiveSeconds: 120,
  /** Longest possible video, seconds. */
  durationSeconds: 20 * 60,
}

/** Media ids inside a project (and in share URLs). */
export const ASSET_ID_RE = /^[A-Za-z0-9_-]{2,32}$/

/** The keys of a record, typed: the compiler makes sure every member of the union is listed. */
const all = <T extends string>(values: Record<T, true>) => Object.keys(values) as T[]

export const APPS = all<AppKind>({ imessage: true, whatsapp: true })
export const APPEARANCES = all<Appearance>({ light: true, dark: true })
export const LOCALES = all<ChatLocale>({ en: true, tr: true, es: true, de: true, fr: true, pt: true })
export const DEVICE_IDS = all<DeviceId>({ 'iphone-17-pro': true, 'iphone-17-pro-max': true, 'iphone-16': true, 'iphone-14': true, 'iphone-se': true })
export const LAYOUTS = all<LayoutKind>({ fullscreen: true, mockup: true, split: true })
export const RECEIPT_MODES = all<ReceiptMode>({ read: true, delivered: true, none: true })
export const KEYBOARD_MODES = all<KeyboardMode>({ off: true, typing: true, always: true })
const BACKGROUND_KINDS = all<BackgroundKind>({ color: true, gradient: true, image: true, video: true })
const SERVICES = all<Project['chat']['service']>({ imessage: true, sms: true })

type Fields = Record<string, unknown>

const isFields = (v: unknown): v is Fields => typeof v === 'object' && v !== null && !Array.isArray(v)
const fields = (v: unknown): Fields => (isFields(v) ? v : {})

function oneOf<T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function text(v: unknown, fallback: string, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : fallback
}

function assetRef(v: unknown, fallback: string | null): string | null {
  if (v === null) return null
  return typeof v === 'string' && ASSET_ID_RE.test(v) ? v : fallback
}

/** Allowed range of every number in Timing. Wider than the sliders: scripts can set them with @settings. */
const TIMING_RANGES: Record<Exclude<keyof Timing, 'typingIndicator'>, [min: number, max: number]> = {
  speed: [0.1, 10],
  startDelay: [0, 30],
  endHold: [0, 60],
  typingCps: [1, 100],
  minTyping: [0, 30],
  maxTyping: [0, 60],
  typingStops: [0, 1],
  readBase: [0, 30],
  readPerChar: [0, 1],
  readMin: [0, 30],
  readMax: [0, 60],
  keyboardCps: [1, 100],
  jitter: [0, 1],
  typoRate: [0, 1],
  lateTypo: [0, 1],
  hesitation: [0, 1],
  hesitationMin: [0, 30],
  hesitationMax: [0, 60],
  keyboardOpen: [0, 10],
  keyboardLinger: [0, 30],
  seed: [-1e9, 1e9],
}

/** Timing with every value inside its allowed range; anything missing or invalid comes from `fallback`. */
export function clampTiming(raw: unknown, fallback: Timing): Timing {
  const t = fields(raw)
  const out: Timing = { ...fallback, typingIndicator: bool(t.typingIndicator, fallback.typingIndicator) }
  for (const key of Object.keys(TIMING_RANGES) as (keyof typeof TIMING_RANGES)[]) {
    const [min, max] = TIMING_RANGES[key]
    out[key] = num(t[key], num(fallback[key], min, min, max), min, max)
  }
  return out
}

function participant(raw: unknown): Participant[] {
  const p = fields(raw)
  if (typeof p.id !== 'string' || !p.id) return []
  const out: Participant = { id: p.id.slice(0, 200), name: text(p.name, p.id, 200), isMe: p.isMe === true, avatar: assetRef(p.avatar, null) }
  if (typeof p.emoji === 'string' && p.emoji) out.emoji = p.emoji.slice(0, 32)
  if (typeof p.color === 'string' && p.color) out.color = p.color.slice(0, 64)
  return [out]
}

/** A complete, valid project from untrusted JSON. Missing or invalid fields come from `defaults`. */
export function sanitizeProject(raw: unknown, defaults: Project): Project {
  const d = defaults
  const p = fields(raw)
  const background = fields(p.background)
  const status = fields(p.status)
  const chat = fields(p.chat)
  const sound = fields(p.sound)
  return {
    version: 1,
    app: oneOf(p.app, APPS, d.app),
    appearance: oneOf(p.appearance, APPEARANCES, d.appearance),
    locale: oneOf(p.locale, LOCALES, d.locale),
    clock24: bool(p.clock24, d.clock24),
    device: oneOf(p.device, DEVICE_IDS, d.device),
    layout: oneOf(p.layout, LAYOUTS, d.layout),
    splitRatio: num(p.splitRatio, d.splitRatio, 0.2, 0.9),
    fps: oneOf(p.fps, [30, 60] as const, d.fps),
    resolution: oneOf(p.resolution, [1080, 720] as const, d.resolution),
    background: {
      kind: oneOf(background.kind, BACKGROUND_KINDS, d.background.kind),
      color: text(background.color, d.background.color, 64),
      color2: text(background.color2, d.background.color2, 64),
      asset: assetRef(background.asset, d.background.asset),
      dim: num(background.dim, d.background.dim, 0, 1),
    },
    status: {
      time: text(status.time, d.status.time, 16),
      battery: num(status.battery, d.status.battery, 1, 100),
      signal: Math.round(num(status.signal, d.status.signal, 0, 4)),
      wifi: bool(status.wifi, d.status.wifi),
      charging: bool(status.charging, d.status.charging),
      showIsland: bool(status.showIsland, d.status.showIsland),
    },
    chat: {
      title: text(chat.title, d.chat.title, 200),
      subtitle: text(chat.subtitle, d.chat.subtitle, 200),
      avatar: assetRef(chat.avatar, d.chat.avatar),
      service: oneOf(chat.service, SERVICES, d.chat.service),
      unread: Math.round(num(chat.unread, d.chat.unread, 0, 99_999)),
      wallpaper: assetRef(chat.wallpaper, d.chat.wallpaper),
      showEncryptionNotice: bool(chat.showEncryptionNotice, d.chat.showEncryptionNotice),
      localizeStamps: bool(chat.localizeStamps, d.chat.localizeStamps),
      group: bool(chat.group, d.chat.group),
      clock: text(chat.clock, d.chat.clock, 16),
    },
    participants: Array.isArray(p.participants) ? p.participants.slice(0, LIMITS.participants).flatMap(participant) : [],
    script: typeof p.script === 'string' ? p.script.slice(0, LIMITS.scriptChars) : d.script,
    timing: clampTiming(p.timing, d.timing),
    preset: text(p.preset, '', 40),
    receipts: oneOf(p.receipts, RECEIPT_MODES, d.receipts),
    // Projects from before the keyboard modes stored a boolean.
    keyboard: typeof p.keyboard === 'boolean' ? (p.keyboard ? 'always' : 'off') : oneOf(p.keyboard, KEYBOARD_MODES, d.keyboard),
    sound: {
      enabled: bool(sound.enabled, d.sound.enabled),
      volume: num(sound.volume, d.sound.volume, 0, 1),
      keyboardClicks: bool(sound.keyboardClicks, d.sound.keyboardClicks),
      music: assetRef(sound.music, d.sound.music),
      musicVolume: num(sound.musicVolume, d.sound.musicVolume, 0, 1),
      videoAudio: bool(sound.videoAudio, d.sound.videoAudio),
    },
  }
}
