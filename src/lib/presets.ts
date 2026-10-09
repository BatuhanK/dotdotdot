import { clampTiming, DEVICE_IDS, KEYBOARD_MODES, LAYOUTS, LOCALES, RECEIPT_MODES } from './project-schema'
import type { KeyboardMode, Project, Timing } from './types'

export interface RealismPreset {
  id: string
  emoji: string
  label: { en: string; tr: string }
  description: { en: string; tr: string }
  keyboard: KeyboardMode
  timing: Partial<Timing>
}

export const BASE_TIMING: Timing = {
  speed: 1,
  startDelay: 0.5,
  endHold: 2.2,
  typingIndicator: true,
  typingCps: 15,
  minTyping: 0.9,
  maxTyping: 2.8,
  typingStops: 0.12,
  readBase: 0.75,
  readPerChar: 0.035,
  readMin: 0.8,
  readMax: 3,
  keyboardCps: 13,
  jitter: 0.35,
  typoRate: 0.025,
  lateTypo: 0.25,
  hesitation: 0.15,
  hesitationMin: 0.6,
  hesitationMax: 1.6,
  keyboardOpen: 0.45,
  keyboardLinger: 0.8,
  seed: 7,
}

export const PRESETS: RealismPreset[] = [
  {
    id: 'natural',
    emoji: '💬',
    label: { en: 'Natural', tr: 'Doğal' },
    description: {
      en: 'Everyday texting: keyboard opens when you type, a typo now and then, short thinking pauses.',
      tr: 'Günlük mesajlaşma: yazarken klavye açılır, arada bir yazım hatası, kısa düşünme duraklamaları.',
    },
    keyboard: 'typing',
    timing: {},
  },
  {
    id: 'viral',
    emoji: '⚡️',
    label: { en: 'Viral / snappy', tr: 'Viral / hızlı' },
    description: {
      en: 'Fast pacing for TikTok & Reels: quick typing, short reading time, few typos.',
      tr: 'TikTok ve Reels için hızlı tempo: hızlı yazma, kısa okuma süresi, az hata.',
    },
    keyboard: 'typing',
    timing: {
      speed: 1.25,
      keyboardCps: 18,
      typingCps: 20,
      typoRate: 0.012,
      hesitation: 0.06,
      typingStops: 0.05,
      readPerChar: 0.028,
      readBase: 0.6,
      keyboardLinger: 0.6,
      endHold: 1.8,
    },
  },
  {
    id: 'drama',
    emoji: '🎭',
    label: { en: 'Drama / suspense', tr: 'Dram / gerilim' },
    description: {
      en: 'Long typing bubbles, they start typing and stop, you hesitate before hitting send.',
      tr: 'Uzun "yazıyor" balonları, karşı taraf yazıp duruyor, sen göndermeden önce tereddüt ediyorsun.',
    },
    keyboard: 'typing',
    timing: {
      speed: 0.9,
      typingCps: 8,
      maxTyping: 4.8,
      typingStops: 0.45,
      keyboardCps: 9,
      hesitation: 0.45,
      hesitationMin: 0.9,
      hesitationMax: 2.4,
      typoRate: 0.02,
      readBase: 1.1,
      readMax: 3.8,
      endHold: 3,
    },
  },
  {
    id: 'fast-texter',
    emoji: '🔥',
    label: { en: 'Fast texter', tr: 'Hızlı yazan' },
    description: {
      en: 'Thumbs flying: very fast typing with more typos that get fixed on the fly.',
      tr: 'Parmaklar uçuyor: çok hızlı yazma, anında düzeltilen daha fazla hata.',
    },
    keyboard: 'typing',
    timing: { keyboardCps: 22, jitter: 0.45, typoRate: 0.05, lateTypo: 0.4, hesitation: 0.05, typingCps: 22, readPerChar: 0.03 },
  },
  {
    id: 'careful',
    emoji: '🧐',
    label: { en: 'Careful writer', tr: 'Dikkatli yazan' },
    description: {
      en: 'Slow, deliberate typing with almost no typos and longer thinking pauses.',
      tr: 'Yavaş ve özenli yazma, neredeyse hiç hata yok, daha uzun düşünme molaları.',
    },
    keyboard: 'typing',
    timing: { keyboardCps: 8, jitter: 0.25, typoRate: 0.004, lateTypo: 0.1, hesitation: 0.3, hesitationMin: 0.8, hesitationMax: 2 },
  },
  {
    id: 'parent',
    emoji: '👵',
    label: { en: 'Mom / Dad typing', tr: 'Anne / baba yazıyor' },
    description: {
      en: 'One-finger typing: very slow, lots of typos, long pauses between words.',
      tr: 'Tek parmakla yazma: çok yavaş, bol hata, kelimeler arasında uzun duraklamalar.',
    },
    keyboard: 'typing',
    timing: {
      keyboardCps: 4.5,
      jitter: 0.6,
      typoRate: 0.08,
      lateTypo: 0.5,
      hesitation: 0.55,
      hesitationMin: 0.8,
      hesitationMax: 2.2,
      typingCps: 5,
      maxTyping: 5,
    },
  },
  {
    id: 'instant',
    emoji: '📨',
    label: { en: 'No typing', tr: 'Yazma yok' },
    description: {
      en: 'Messages just pop in. Good for long stories where pacing matters more than typing.',
      tr: 'Mesajlar direkt düşer. Yazmadan çok temponun önemli olduğu uzun hikayeler için.',
    },
    keyboard: 'off',
    timing: { typingIndicator: true, typingStops: 0, hesitation: 0, speed: 1.15 },
  },
]

export function presetById(id: string): RealismPreset | undefined {
  return PRESETS.find((p) => p.id === id)
}

/** Timing + keyboard mode for a preset, keeping the current seed. */
export function applyPreset(project: Project, id: string): Project {
  const p = presetById(id)
  if (!p) return project
  return { ...project, preset: id, keyboard: p.keyboard, timing: { ...BASE_TIMING, ...p.timing, seed: project.timing.seed } }
}

// ------------------------------------------------------------- @settings from the script

const LEVELS: Record<string, number> = { off: 0, none: 0, no: 0, low: 0.012, some: 0.025, medium: 0.04, high: 0.07, lots: 0.1 }

function num(v: string): number | undefined {
  const n = parseFloat(v)
  return Number.isNaN(n) ? undefined : n
}
function bool(v: string): boolean | undefined {
  if (/^(on|yes|true|1|açık|evet)$/i.test(v)) return true
  if (/^(off|no|false|0|kapalı|hayır)$/i.test(v)) return false
  return undefined
}

/** Numeric @settings that map 1:1 onto a timing field. */
const NUMERIC_TIMING: Record<string, keyof Timing> = {
  rhythm: 'jitter',
  late_typos: 'lateTypo',
  keyboard_open: 'keyboardOpen',
  keyboard_linger: 'keyboardLinger',
  typing_stops: 'typingStops',
  typing_min: 'minTyping',
  typing_max: 'maxTyping',
  read_base: 'readBase',
  read_per_char: 'readPerChar',
  read_max: 'readMax',
  start_delay: 'startDelay',
  end_hold: 'endHold',
}

export const SETTING_KEYS = [
  'preset',
  'me',
  'title',
  'theme',
  'bubbles',
  'language',
  'clock',
  'time',
  'status_time',
  'battery',
  'signal',
  'wifi',
  'charging',
  'device',
  'layout',
  'keyboard',
  'typing_speed',
  'their_typing_speed',
  'typos',
  'speed',
  'receipts',
  'typing_indicator',
  'unread',
  'seed',
  'hesitation',
] as const

/** Apply @settings found in the script on top of the editor settings. Returns the keys that were applied. */
export function applyScriptSettings(project: Project, s: Record<string, string>): { project: Project; applied: string[] } {
  let p = project
  const applied: string[] = []
  const mark = (k: string) => applied.push(k)
  if (s.preset && presetById(s.preset.toLowerCase())) {
    p = applyPreset(p, s.preset.toLowerCase())
    mark('preset')
  }
  const t = { ...p.timing }
  const set = <K extends keyof Project>(k: K, v: Project[K]) => {
    p = { ...p, [k]: v }
  }
  for (const [key, raw] of Object.entries(s)) {
    const v = raw.trim()
    const lv = v.toLowerCase()
    switch (key) {
      case 'title':
        p = { ...p, chat: { ...p.chat, title: v } }
        mark(key)
        break
      case 'app':
      case 'messenger':
        if (/^(whatsapp|wa)$/.test(lv)) (set('app', 'whatsapp'), mark('app'))
        else if (/^(imessage|messages|ios)$/.test(lv)) (set('app', 'imessage'), mark('app'))
        break
      case 'theme':
      case 'appearance':
        if (lv === 'dark' || lv === 'light') (set('appearance', lv), mark('theme'))
        break
      case 'bubbles':
      case 'service':
        if (/^(green|sms)$/.test(lv)) ((p = { ...p, chat: { ...p.chat, service: 'sms' } }), mark('bubbles'))
        else if (/^(blue|imessage)$/.test(lv)) ((p = { ...p, chat: { ...p.chat, service: 'imessage' } }), mark('bubbles'))
        break
      case 'language':
      case 'lang':
        if ((LOCALES as string[]).includes(lv)) (set('locale', lv as Project['locale']), mark('language'))
        break
      case 'clock':
        if (/24/.test(lv)) (set('clock24', true), mark(key))
        else if (/12/.test(lv)) (set('clock24', false), mark(key))
        break
      case 'time':
        if (/^\d{1,2}[:.]\d{2}/.test(v)) ((p = { ...p, chat: { ...p.chat, clock: v.replace('.', ':') } }), mark(key))
        break
      case 'status_time':
        p = { ...p, status: { ...p.status, time: v } }
        mark(key)
        break
      case 'battery': {
        const n = num(v)
        if (n !== undefined) ((p = { ...p, status: { ...p.status, battery: Math.max(1, Math.min(100, n)) } }), mark(key))
        break
      }
      case 'signal': {
        const n = num(v)
        if (n !== undefined) ((p = { ...p, status: { ...p.status, signal: Math.max(0, Math.min(4, Math.round(n))) } }), mark(key))
        break
      }
      case 'wifi':
      case 'charging': {
        const b = bool(v)
        if (b !== undefined) ((p = { ...p, status: { ...p.status, [key]: b } }), mark(key))
        break
      }
      case 'device': {
        const id = lv.replace(/\s+/g, '-')
        if ((DEVICE_IDS as string[]).includes(id)) (set('device', id as Project['device']), mark(key))
        break
      }
      case 'layout':
        if ((LAYOUTS as string[]).includes(lv)) (set('layout', lv as Project['layout']), mark(key))
        break
      case 'keyboard':
        if ((KEYBOARD_MODES as string[]).includes(lv)) (set('keyboard', lv as Project['keyboard']), mark(key))
        else if (bool(v) !== undefined) (set('keyboard', bool(v) ? 'typing' : 'off'), mark(key))
        break
      case 'typing_speed': {
        const n = num(v)
        if (n) ((t.keyboardCps = n), mark(key))
        break
      }
      case 'their_typing_speed': {
        const n = num(v)
        if (n) ((t.typingCps = n), mark(key))
        break
      }
      case 'typos': {
        const n = LEVELS[lv] ?? num(v)
        if (n !== undefined) ((t.typoRate = n > 1 ? n / 100 : n), mark(key))
        break
      }
      case 'hesitation': {
        const n = LEVELS[lv] !== undefined ? LEVELS[lv] * 6 : num(v)
        if (n !== undefined) ((t.hesitation = Math.min(1, n > 1 ? n / 100 : n)), mark(key))
        break
      }
      case 'speed': {
        const n = num(v)
        if (n) ((t.speed = n), mark(key))
        break
      }
      case 'seed': {
        const n = num(v)
        if (n !== undefined) ((t.seed = n), mark(key))
        break
      }
      case 'typing_indicator': {
        const b = bool(v)
        if (b !== undefined) ((t.typingIndicator = b), mark(key))
        break
      }
      case 'receipts':
        if ((RECEIPT_MODES as string[]).includes(lv)) (set('receipts', lv as Project['receipts']), mark(key))
        break
      case 'unread': {
        const n = num(v)
        if (n !== undefined) ((p = { ...p, chat: { ...p.chat, unread: Math.max(0, Math.round(n)) } }), mark(key))
        break
      }
      case 'group': {
        const b = bool(v)
        if (b === false) p = { ...p, chat: { ...p.chat, group: false } }
        else if (b === true) p = { ...p, chat: { ...p.chat, group: true } }
        else if (v) p = { ...p, chat: { ...p.chat, group: true, title: v } }
        mark('group')
        break
      }
      case 'timestamps':
      case 'translate_timestamps': {
        const b = /^(literal|off|no|false|as-?is)$/i.test(v) ? false : /^(auto|on|yes|true|translate|localize)$/i.test(v) ? true : undefined
        if (b !== undefined) ((p = { ...p, chat: { ...p.chat, localizeStamps: b } }), mark('timestamps'))
        break
      }
      case 'pause_length': {
        const m = /^([\d.]+)\s*(?:s|sec)?\s*(?:-|–|to)\s*([\d.]+)/i.exec(v)
        if (m) ((t.hesitationMin = parseFloat(m[1])), (t.hesitationMax = Math.max(parseFloat(m[1]), parseFloat(m[2]))), mark(key))
        break
      }
      case 'me':
        mark(key)
        break
      default: {
        const field = NUMERIC_TIMING[key]
        const n = num(v)
        if (field && n !== undefined) {
          const pctKeys = ['jitter', 'lateTypo', 'typingStops']
          ;(t as unknown as Record<string, number>)[field] = pctKeys.includes(field) && n > 1 ? n / 100 : n
          mark(key)
        }
      }
    }
  }
  // A script that picks a phone language but no clock gets that country's usual clock.
  if (applied.includes('language') && !applied.includes('clock')) p = { ...p, clock24: p.locale !== 'en' }
  // The status bar shows the same "now" as the chat unless the script says otherwise.
  if (applied.includes('time') && !applied.includes('status_time')) {
    const m = /^(\d{1,2}):(\d{2})/.exec(p.chat.clock)
    if (m) {
      const h = parseInt(m[1], 10)
      p = { ...p, status: { ...p.status, time: p.clock24 ? `${String(h).padStart(2, '0')}:${m[2]}` : `${h % 12 === 0 ? 12 : h % 12}:${m[2]}` } }
    }
  }
  // @settings can ask for any number; keep the timing in a range the renderer and exporter can handle.
  return { project: { ...p, timing: clampTiming(t, BASE_TIMING) }, applied }
}
