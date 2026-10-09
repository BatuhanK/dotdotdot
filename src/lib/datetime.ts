import type { ChatStrings } from './i18n'
import type { ChatLocale } from './types'

/*
 * Timestamps are written in whatever language (usually English, by AI agents) and shown the way
 * iOS would show them in the phone's language: "--- Yesterday 7:14 PM ---" → "Dün 19:14".
 */

export type Day = { kind: 'today' } | { kind: 'yesterday' } | { kind: 'weekday'; weekday: number } | { kind: 'date'; month: number; day: number; year?: number }

export interface Stamp {
  day: Day | null
  /** 24h "H:MM" */
  time: string | null
}

const DAY_WORDS: Record<string, 'today' | 'yesterday'> = {
  today: 'today',
  bugün: 'today',
  bugun: 'today',
  hoy: 'today',
  heute: 'today',
  "aujourd'hui": 'today',
  'aujourd’hui': 'today',
  hoje: 'today',
  yesterday: 'yesterday',
  dün: 'yesterday',
  dun: 'yesterday',
  ayer: 'yesterday',
  gestern: 'yesterday',
  hier: 'yesterday',
  ontem: 'yesterday',
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  pazar: 0,
  pazartesi: 1,
  pzt: 1,
  salı: 2,
  sali: 2,
  çarşamba: 3,
  carsamba: 3,
  çar: 3,
  perşembe: 4,
  persembe: 4,
  per: 4,
  cuma: 5,
  cumartesi: 6,
  cmt: 6,
  domingo: 0,
  lunes: 1,
  martes: 2,
  miércoles: 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  sabado: 6,
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  segunda: 1,
  'segunda-feira': 1,
  terça: 2,
  'terça-feira': 2,
  terca: 2,
  quarta: 3,
  'quarta-feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
  ocak: 0,
  oca: 0,
  şubat: 1,
  subat: 1,
  şub: 1,
  mart: 2,
  nisan: 3,
  nis: 3,
  mayıs: 4,
  mayis: 4,
  haziran: 5,
  haz: 5,
  temmuz: 6,
  tem: 6,
  ağustos: 7,
  agustos: 7,
  ağu: 7,
  eylül: 8,
  eylul: 8,
  eyl: 8,
  ekim: 9,
  eki: 9,
  kasım: 10,
  kasim: 10,
  kas: 10,
  aralık: 11,
  aralik: 11,
  ara: 11,
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
  januar: 0,
  februar: 1,
  märz: 2,
  maerz: 2,
  mai: 4,
  juni: 5,
  juli: 6,
  oktober: 9,
  dezember: 11,
  janvier: 0,
  février: 1,
  fevrier: 1,
  mars: 2,
  avril: 3,
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11,
  janeiro: 0,
  fevereiro: 1,
  março: 2,
  marco: 2,
  maio: 4,
  junho: 5,
  julho: 6,
  setembro: 8,
  outubro: 9,
  dezembro: 11,
}

/** Filler words that may appear between day and time ("Monday at 9:41 PM", "Dün saat 19:14"). */
const FILLER = new Set(['at', 'saat', 'a', 'las', 'la', 'um', 'uhr', 'à', 'a', 'às', 'as', 'de', 'del', 'the', 'on', ',', '-', '·'])

const RE_TIME = /(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?|öö|ös)?/i
const RE_ISO = /(\d{4})-(\d{1,2})-(\d{1,2})/
const RE_DMY = /(\d{1,2})[./](\d{1,2})[./](\d{2,4})/

/** Parse a timestamp label. Returns null when the text isn't a recognisable date/time. */
export function parseStamp(text: string): Stamp | null {
  let rest = ` ${text.trim().toLocaleLowerCase()} `
  let time: string | null = null
  const tm = RE_TIME.exec(rest)
  if (tm) {
    let h = parseInt(tm[1], 10)
    const ap = tm[3]?.replace(/\./g, '').toLowerCase()
    if ((ap === 'pm' || ap === 'ös') && h < 12) h += 12
    if ((ap === 'am' || ap === 'öö') && h === 12) h = 0
    if (h < 24 && parseInt(tm[2], 10) < 60) time = `${h}:${tm[2]}`
    rest = rest.replace(tm[0], ' ')
  }
  let day: Day | null = null
  const iso = RE_ISO.exec(rest)
  const dmy = RE_DMY.exec(rest)
  if (iso) {
    day = { kind: 'date', year: +iso[1], month: +iso[2] - 1, day: +iso[3] }
    rest = rest.replace(iso[0], ' ')
  } else if (dmy) {
    day = { kind: 'date', day: +dmy[1], month: +dmy[2] - 1, year: dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3] }
    rest = rest.replace(dmy[0], ' ')
  }
  const words = rest.split(/[\s,]+/).filter(Boolean)
  const left: string[] = []
  let month: number | null = null
  let dayNum: number | null = null
  for (const w of words) {
    const clean = w.replace(/[.,]$/, '')
    if (!day && DAY_WORDS[clean]) day = { kind: DAY_WORDS[clean] }
    else if (!day && WEEKDAYS[clean] !== undefined && (words.length < 4 || month === null)) day = { kind: 'weekday', weekday: WEEKDAYS[clean] }
    else if (MONTHS[clean] !== undefined) month = MONTHS[clean]
    else if (/^\d{1,2}(st|nd|rd|th|\.)?$/.test(clean)) dayNum = parseInt(clean, 10)
    else if (/^\d{4}$/.test(clean)) continue
    else if (!FILLER.has(clean)) left.push(clean)
  }
  if (month !== null && dayNum !== null) day = { kind: 'date', month, day: dayNum }
  else if (month !== null && day?.kind === 'weekday') day = { kind: 'weekday', weekday: day.weekday }
  // Too much unknown text → it's a custom label, keep it literal.
  if (left.length > 0 || (!day && !time)) return null
  return { day, time }
}

const CONNECTOR: Record<ChatLocale, string> = { en: 'at', tr: '', es: '', de: '', fr: '', pt: '' }

function weekdayName(weekday: number, locale: ChatLocale): string {
  // 2026-01-04 is a Sunday.
  const d = new Date(Date.UTC(2026, 0, 4 + weekday, 12))
  const s = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(d)
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
}

function dateLabel(day: Extract<Day, { kind: 'date' }>, locale: ChatLocale): string {
  const d = new Date(Date.UTC(day.year ?? 2026, day.month, day.day, 12))
  const s = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d)
  return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
}

export function formatClock(clock: string, clock24: boolean): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(clock.trim())
  if (!m) return clock
  const h = parseInt(m[1], 10)
  const min = m[2]
  if (clock24) return `${String(h).padStart(2, '0')}:${min}`
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${min} ${h < 12 ? 'AM' : 'PM'}`
}

/** iOS-style label for a parsed timestamp, in the phone's language. */
export function formatStamp(stamp: Stamp, locale: ChatLocale, clock24: boolean, strings: ChatStrings): string {
  const time = stamp.time ? formatClock(stamp.time, clock24) : ''
  const day = stamp.day ?? (time ? { kind: 'today' as const } : null)
  if (!day) return time
  let dayText: string
  if (day.kind === 'today') dayText = strings.today
  else if (day.kind === 'yesterday') dayText = strings.yesterday
  else if (day.kind === 'weekday') dayText = weekdayName(day.weekday, locale)
  else dayText = dateLabel(day, locale)
  if (!time) return dayText
  const conn = day.kind === 'date' && CONNECTOR[locale] ? ` ${CONNECTOR[locale]}` : ''
  return `${dayText}${conn} ${time}`
}

/** Label to draw for a timestamp line, translated unless `localize` is off. */
export function stampLabel(text: string, locale: ChatLocale, clock24: boolean, strings: ChatStrings, localize: boolean): string {
  if (!localize) return text
  const s = parseStamp(text)
  return s ? formatStamp(s, locale, clock24, strings) : text
}

/** Day-only label for WhatsApp's date chips ("Yesterday 7:14 PM" → "Yesterday"; a bare time means today). */
export function dayLabel(text: string, locale: ChatLocale, strings: ChatStrings, localize: boolean): string {
  const s = parseStamp(text)
  if (!s) return text
  const day = s.day ?? { kind: 'today' as const }
  if (!localize && s.day)
    return (
      text
        .replace(RE_TIME, '')
        .replace(/\s+(at|saat)?\s*$/i, '')
        .trim() || strings.today
    )
  if (day.kind === 'today') return strings.today
  if (day.kind === 'yesterday') return strings.yesterday
  if (day.kind === 'weekday') return weekdayName(day.weekday, locale)
  return dateLabel(day, locale)
}
