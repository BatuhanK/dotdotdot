import { layoutKeys } from '../render/keyboard'
import { parseStamp } from './datetime'
import { LIMITS } from './project-schema'
import { ME_ALIASES, participantId } from './script'
import type { Message, Participant, Project, TypingOp } from './types'

export type SoundId = 'imessage-send' | 'imessage-receive' | 'whatsapp-send' | 'whatsapp-receive' | 'key-click' | 'key-delete' | 'tapback'

export interface TimedReaction {
  emoji: string
  from: Participant | null
  /** true when the reactor is "me". */
  mine: boolean
  at: number
}

/** One keystroke on my keyboard. `text` is the composer content right after it. */
export interface KeyEvent {
  at: number
  kind: 'char' | 'delete'
  char: string
  text: string
}

export interface TimedItem {
  index: number
  msg: Message
  /** typing = a typing bubble that disappears without a message. */
  kind: 'text' | 'image' | 'timestamp' | 'typing' | 'system'
  side: 'me' | 'them' | 'center'
  from: Participant | null
  appearAt: number
  /** Incoming: intervals where the typing bubble is visible. */
  typing: [number, number][]
  /** Outgoing: keystrokes typed into the composer for this message. */
  keys: KeyEvent[]
  composeStart: number | null
  /** false for my messages that were typed and deleted again (never sent). */
  sent: boolean
  deliveredAt: number
  readAt: number
  /** "HH:MM" (24h) clock for this message. */
  clock: string
  reactions: TimedReaction[]
}

export interface Timeline {
  items: TimedItem[]
  duration: number
  sounds: { at: number; id: SoundId }[]
  keys: KeyEvent[]
  participants: Participant[]
  /** When the keyboard is up (typing mode). Always-on mode is one open-ended span. */
  keyboardSpans: { openAt: number; closeAt: number }[]
}

/** Merge participants from the script with stored per-person settings. */
export function resolveParticipants(
  project: Project,
  names: string[],
  meName?: string,
  avatars: { name: string; emoji: string; color?: string }[] = [],
): Participant[] {
  const stored = new Map(project.participants.map((p) => [p.id, p]))
  const emoji = new Map(avatars.map((a) => [participantId(a.name), a]))
  const meId = meName ? participantId(meName) : null
  let list = names.map((name) => {
    const id = participantId(name)
    const s = stored.get(id)
    const base: Participant = s ? { ...s, name } : { id, name, isMe: ME_ALIASES.has(id), avatar: null }
    const e = emoji.get(id)
    return e ? { ...base, emoji: e.emoji, color: e.color ?? base.color } : base
  })
  if (meId && list.some((p) => p.id === meId)) list = list.map((p) => ({ ...p, isMe: p.id === meId }))
  if (list.length > 1 && !list.some((p) => p.isMe)) list[1] = { ...list[1], isMe: true }
  return list
}

function clockFromText(text: string): string | null {
  return parseStamp(text)?.time ?? null
}

/** Items written before <start> are on screen from the first frame. */
const HISTORY_AT = -10

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

const graphemeSeg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
function graphemes(s: string): string[] {
  return Array.from(graphemeSeg.segment(s), (x) => x.segment)
}

/** Visible length of a message (emoji count as one). */
export function textLength(text: string): number {
  return graphemes(text).length
}

// ------------------------------------------------------------------ deterministic randomness

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ------------------------------------------------------------------ neighbouring keys (typos)

const neighbourCache = new Map<string, Map<string, string[]>>()

function neighbours(locale: string): Map<string, string[]> {
  let m = neighbourCache.get(locale)
  if (m) return m
  const { letters } = layoutKeys(402, locale)
  m = new Map()
  for (const a of letters) {
    const ax = a.x + a.w / 2
    const ay = a.y + a.h / 2
    const near = letters
      .filter((b) => b !== a)
      .map((b) => ({ b, d: Math.hypot(b.x + b.w / 2 - ax, (b.y + b.h / 2 - ay) * 1.15) }))
      .filter((x) => x.d < a.w * 1.75)
      .sort((x, y) => x.d - y.d)
      .slice(0, 4)
      .map((x) => x.b.label)
    m.set(a.label, near)
  }
  neighbourCache.set(locale, m)
  return m
}

function wrongKey(ch: string, locale: string, rnd: () => number): string | null {
  const lower = locale === 'tr' ? ch.toLocaleLowerCase('tr') : ch.toLowerCase()
  const n = neighbours(locale).get(lower)
  if (!n || !n.length) return null
  // Same-row neighbours are more likely than diagonal ones.
  const pick = n[Math.min(n.length - 1, Math.floor(Math.pow(rnd(), 1.6) * n.length))]
  const upper = lower !== ch
  return upper ? (locale === 'tr' ? pick.toLocaleUpperCase('tr') : pick.toUpperCase()) : pick
}

// ------------------------------------------------------------------ keyboard typing plan

interface TypingConfig {
  cps: number
  jitter: number
  typoRate: number
  lateTypo: number
  hesitation: number
  hesitationMin: number
  hesitationMax: number
  locale: string
}

interface PlanEvent {
  dt: number
  kind: 'char' | 'delete'
  char: string
}

/** Turn the typing ops of one message into timed keystrokes (relative times). */
export function planTyping(ops: TypingOp[], cfg: TypingConfig, rnd: () => number): PlanEvent[] {
  const events: PlanEvent[] = []
  let speed = 1
  let prev = ''
  const base = 1 / Math.max(1, cfg.cps)
  const gap = (ch: string) => {
    let d = base * (1 + (rnd() * 2 - 1) * cfg.jitter)
    if (prev === ' ') d *= 1.18
    if (/[.,!?;:…]/.test(prev)) d *= 1.7
    if (/\p{Extended_Pictographic}/u.test(ch)) d *= 2.4
    if (/\p{Lu}/u.test(ch) && prev !== '') d *= 1.25
    if (/\d/.test(ch) !== /\d/.test(prev) && prev !== '') d *= 1.3
    return Math.max(0.035, d / speed)
  }
  const type = (ch: string, wait?: number) => {
    events.push({ dt: wait ?? gap(ch), kind: 'char', char: ch })
    prev = ch
  }
  const del = (n: number, first = 0.32) => {
    for (let i = 0; i < n; i++) {
      // Holding backspace accelerates after a few characters.
      const d = i === 0 ? first : i < 5 ? 0.11 + rnd() * 0.04 : 0.055
      events.push({ dt: d / Math.max(0.6, speed), kind: 'delete', char: '' })
    }
    prev = ''
  }
  const textBuf = () => {
    let n = 0
    for (const e of events) n = e.kind === 'char' ? n + 1 : Math.max(0, n - 1)
    return n
  }
  // Decide up front whether this message gets a "thinking" pause, and roughly where.
  const plainLen = ops.reduce((n, o) => n + (o.kind === 'type' ? graphemes(o.text).length : 0), 0)
  let hesitateAt = cfg.hesitation > 0 && plainLen > 8 && rnd() < cfg.hesitation ? Math.floor(plainLen * (0.25 + rnd() * 0.5)) : -1
  let typed = 0

  for (const op of ops) {
    if (op.kind === 'speed') {
      speed = op.factor
    } else if (op.kind === 'pause') {
      events.push({ dt: op.seconds, kind: 'char', char: '' })
    } else if (op.kind === 'typo') {
      const next = ops[ops.indexOf(op) + 1]
      const target = next && next.kind === 'type' ? (graphemes(next.text)[0] ?? 'a') : 'a'
      const w = wrongKey(target, cfg.locale, rnd) ?? 'x'
      type(w)
      del(1, 0.28 + rnd() * 0.25)
    } else if (op.kind === 'mistake') {
      for (const g of graphemes(op.text)) type(g)
      events.push({ dt: 0.35 + rnd() * 0.45, kind: 'char', char: '' })
      del(graphemes(op.text).length, 0.15)
    } else if (op.kind === 'del') {
      del(Math.min(op.count, textBuf()), 0.3 + rnd() * 0.2)
    } else if (op.kind === 'clear') {
      del(textBuf(), 0.4 + rnd() * 0.3)
    } else if (op.kind === 'type') {
      const gs = graphemes(op.text)
      let noTypoUntil = -1
      for (let i = 0; i < gs.length; i++) {
        const g = gs[i]
        if (hesitateAt >= 0 && typed >= hesitateAt && (g === ' ' || prev === ' ')) {
          events.push({ dt: cfg.hesitationMin + rnd() * Math.max(0, cfg.hesitationMax - cfg.hesitationMin), kind: 'char', char: '' })
          hesitateAt = -1
        }
        const canTypo = i > noTypoUntil && /\p{L}/u.test(g) && rnd() < cfg.typoRate
        const w = canTypo ? wrongKey(g, cfg.locale, rnd) : null
        if (w) {
          type(w)
          // Sometimes the typo is only noticed a letter or two later.
          let extra = 0
          if (rnd() < cfg.lateTypo) {
            extra = Math.min(gs.length - 1 - i, 1 + Math.floor(rnd() * 2))
            for (let k = 1; k <= extra; k++) type(gs[i + k])
          }
          del(extra + 1, 0.22 + rnd() * 0.3)
          noTypoUntil = i + extra
        }
        type(g)
        typed++
      }
    }
  }
  return events
}

// ------------------------------------------------------------------ timeline

export function compileTimeline(project: Project, messages: Message[], participants: Participant[]): Timeline {
  const T = project.timing
  const speed = Math.max(0.1, T.speed)
  const byId = new Map(participants.map((p) => [p.id, p]))
  const me = participants.find((p) => p.isMe) ?? null
  const other = participants.find((p) => !p.isMe) ?? null
  const isWA = project.app === 'whatsapp'
  const mode = project.keyboard
  const cfg: TypingConfig = {
    cps: T.keyboardCps,
    jitter: T.jitter,
    typoRate: T.typoRate,
    lateTypo: T.lateTypo,
    hesitation: T.hesitation,
    hesitationMin: T.hesitationMin,
    hesitationMax: T.hesitationMax,
    locale: project.locale,
  }

  const items: TimedItem[] = []
  const sounds: Timeline['sounds'] = []
  const keys: KeyEvent[] = []
  const spans: Timeline['keyboardSpans'] = mode === 'always' ? [{ openAt: -10, closeAt: Infinity }] : []
  let t = T.startDelay
  let clock = project.chat.clock

  const isTyped = (m: Message | undefined) => {
    if (!m || mode === 'off' || m.instant) return false
    const p = m.from !== undefined ? byId.get(m.from) : undefined
    return !!p?.isMe && m.kind === 'text'
  }
  const nextMessage = (i: number) => messages.slice(i + 1).find((m) => m.kind === 'text' || m.kind === 'image' || m.kind === 'typing')

  messages.forEach((msg, mi) => {
    if (msg.history) {
      if (msg.kind === 'pause' || msg.kind === 'typing') return
      if (msg.kind === 'system') {
        items.push({
          index: items.length,
          msg,
          kind: 'system',
          side: 'center',
          from: null,
          appearAt: HISTORY_AT,
          typing: [],
          keys: [],
          composeStart: null,
          sent: true,
          deliveredAt: HISTORY_AT,
          readAt: HISTORY_AT,
          clock,
          reactions: [],
        })
        return
      }
      if (msg.kind === 'timestamp') {
        const c = clockFromText(msg.text ?? '')
        if (c) clock = c
      }
      const from = msg.kind === 'timestamp' ? null : (msg.from && byId.get(msg.from)) || (msg.from === '' ? other : null)
      const mine = !!from?.isMe
      const sent = msg.kind !== 'text' || (msg.text ?? '').length > 0
      if (!sent) return
      items.push({
        index: items.length,
        msg,
        kind: msg.kind === 'timestamp' ? 'timestamp' : msg.kind === 'image' ? 'image' : 'text',
        side: msg.kind === 'timestamp' ? 'center' : mine ? 'me' : 'them',
        from,
        appearAt: HISTORY_AT,
        typing: [],
        keys: [],
        composeStart: null,
        sent: true,
        deliveredAt: HISTORY_AT,
        readAt: Infinity,
        clock,
        reactions: (msg.reactions ?? []).map((r) => {
          const reactor = r.from ? (byId.get(r.from) ?? null) : mine ? other : me
          return { emoji: r.emoji, from: reactor, mine: !!reactor?.isMe, at: HISTORY_AT }
        }),
      })
      return
    }
    if (msg.wait) t += msg.wait / speed
    if (msg.kind === 'pause') return

    if (msg.kind === 'timestamp') {
      const c = clockFromText(msg.text ?? '')
      if (c) clock = c
      items.push({
        index: items.length,
        msg,
        kind: 'timestamp',
        side: 'center',
        from: null,
        appearAt: t,
        typing: [],
        keys: [],
        composeStart: null,
        sent: true,
        deliveredAt: t,
        readAt: t,
        clock,
        reactions: [],
      })
      return
    }

    if (msg.kind === 'system') {
      items.push({
        index: items.length,
        msg,
        kind: 'system',
        side: 'center',
        from: null,
        appearAt: t,
        typing: [],
        keys: [],
        composeStart: null,
        sent: true,
        deliveredAt: t,
        readAt: t,
        clock,
        reactions: [],
      })
      t += (msg.hold ?? 1.4) / speed
      return
    }

    const from = (msg.from && byId.get(msg.from)) || (msg.from === '' ? other : null)
    const mine = !!from?.isMe
    const rnd = mulberry32(hashString(`${T.seed}|${mi}|${msg.raw ?? msg.text ?? ''}`))

    // A typing bubble that disappears again ("they started typing… and stopped").
    if (msg.kind === 'typing' && !mine) {
      const dur = (msg.typing ?? 2) / speed
      items.push({
        index: items.length,
        msg,
        kind: 'typing',
        side: 'them',
        from,
        appearAt: t + dur,
        typing: [[t, t + dur]],
        keys: [],
        composeStart: null,
        sent: false,
        deliveredAt: t,
        readAt: t,
        clock,
        reactions: [],
      })
      t += dur + 0.7 / speed
      return
    }

    const text = msg.text ?? ''
    const len = msg.kind === 'image' ? 12 : textLength(text)
    const typingIntervals: [number, number][] = []
    let itemKeys: KeyEvent[] = []
    let composeStart: number | null = null

    if (!mine) {
      let dur = msg.typing ?? (T.typingIndicator ? clamp(len / T.typingCps, T.minTyping, T.maxTyping) : 0)
      dur /= speed
      // Inline <pause> in their message = they stop typing for a moment.
      const pauses = (msg.ops ?? []).filter((o): o is { kind: 'pause'; seconds: number } => o.kind === 'pause').map((o) => o.seconds / speed)
      if (!pauses.length && dur > 1.2 && rnd() < T.typingStops) pauses.push((0.7 + rnd() * 1.1) / speed)
      if (dur > 0) {
        let start = t
        const chunks = pauses.length + 1
        const chunk = dur / chunks
        for (let k = 0; k < chunks; k++) {
          typingIntervals.push([start, start + chunk])
          start += chunk + (pauses[k] ?? 0)
        }
        t = start
      } else {
        t += pauses.reduce((a, b) => a + b, 0)
      }
    } else if (isTyped(msg)) {
      // Keyboard opens (typing mode) unless it is still up from my previous message.
      const span = spans[spans.length - 1]
      const open = span && t <= span.closeAt
      if (!open) {
        spans.push({ openAt: t, closeAt: Infinity })
        t += T.keyboardOpen / speed
      } else if (span.closeAt !== Infinity) span.closeAt = Infinity
      composeStart = t
      const plan = planTyping(msg.ops ?? [{ kind: 'type', text }], cfg, rnd)
      const natural = plan.reduce((a, e) => a + e.dt, 0)
      const scale = msg.typing ? msg.typing / Math.max(0.2, natural) : 1
      let buf: string[] = []
      for (const e of plan) {
        t += (e.dt * scale) / speed
        if (e.kind === 'delete') buf = buf.slice(0, -1)
        else if (e.char) buf.push(e.char)
        else continue
        itemKeys.push({ at: t, kind: e.kind, char: e.char, text: buf.join('') })
      }
      t += 0.22 / speed
      keys.push(...itemKeys)
    } else if (msg.typing) {
      t += msg.typing / speed
    }

    const appearAt = t
    const sent = msg.kind === 'image' || text.length > 0
    if (sent) sounds.push({ at: appearAt, id: mine ? (isWA ? 'whatsapp-send' : 'imessage-send') : isWA ? 'whatsapp-receive' : 'imessage-receive' })

    // Keyboard closes a moment after sending, unless my next message follows right away.
    if (mine && mode === 'typing' && spans.length) {
      const span = spans[spans.length - 1]
      span.closeAt = isTyped(nextMessage(mi)) ? Infinity : appearAt + T.keyboardLinger / speed
    }

    const hold = !sent ? 0.6 : (msg.hold ?? (msg.kind === 'image' ? 1.8 : clamp(T.readBase + len * T.readPerChar, T.readMin, T.readMax)))

    const reactions: TimedReaction[] = sent
      ? (msg.reactions ?? []).map((r, i) => {
          const reactor = r.from ? (byId.get(r.from) ?? null) : mine ? other : me
          const at = appearAt + Math.min(hold * 0.75, 0.9) / speed + (i * 0.35) / speed
          return { emoji: r.emoji, from: reactor, mine: !!reactor?.isMe, at }
        })
      : []
    reactions.forEach((r) => sounds.push({ at: r.at, id: 'tapback' }))

    items.push({
      index: items.length,
      msg,
      kind: !sent ? 'typing' : msg.kind === 'image' ? 'image' : 'text',
      side: mine ? 'me' : 'them',
      from,
      appearAt,
      typing: typingIntervals,
      keys: itemKeys,
      composeStart,
      sent,
      deliveredAt: appearAt + 0.35 / speed,
      readAt: Infinity,
      clock,
      reactions,
    })
    itemKeys = []
    t += hold / speed
  })

  // A hard cap, so no script can ask for an endless video.
  const duration = Math.min(t + T.endHold, LIMITS.durationSeconds)
  for (const s of spans) if (s.closeAt === Infinity && mode === 'typing') s.closeAt = duration + 10

  // Read receipts: an outgoing message is read when the other side starts answering.
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.side !== 'me' || !it.sent || project.receipts !== 'read') continue
    const reply = items.slice(i + 1).find((x) => x.side === 'them')
    const replyStart = reply ? (reply.typing[0]?.[0] ?? reply.appearAt) : null
    it.readAt = replyStart !== null ? Math.max(it.deliveredAt + 0.2, replyStart - 0.15) : it.appearAt + 1.4 / speed
  }

  if (mode !== 'off' && project.sound.keyboardClicks) keys.forEach((k) => sounds.push({ at: k.at, id: k.kind === 'delete' ? 'key-delete' : 'key-click' }))
  sounds.sort((a, b) => a.at - b.at)

  return { items, duration, sounds, keys, participants, keyboardSpans: spans }
}
