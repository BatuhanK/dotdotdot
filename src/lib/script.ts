import { LIMITS } from './project-schema'
import type { Message, Participant, Reaction, SystemEvent, TypingOp } from './types'

/*
 * dotdotdot script language (see src/lib/script-docs.ts for the full reference).
 *
 *   @theme dark                         settings (anywhere, usually at the top)
 *   Jessica: hey are you up?            a message
 *   Me: I lo<pause 1s>ve you            typing choreography inside my message
 *   Me: I <mistake hate>love you        type a word, delete it, type the rest
 *   <typing 3s>                         line tags apply to the next message
 *   --- Today 9:41 PM ---               timestamp
 *   # comment
 *
 * Legacy syntax keeps working: [typing 2s], [wait 2s], [hold 2s], [image], {😂 Jessica}.
 */

export interface ScriptError {
  line: number
  message: string
}

export interface ParseResult {
  messages: Message[]
  /** Speaker names in order of first appearance (original casing). */
  names: string[]
  errors: ScriptError[]
  /** @settings: lower-cased key → value (last one wins). */
  settings: Record<string, string>
  /** @avatar lines: emoji avatars per person. */
  avatars: { name: string; emoji: string; color?: string }[]
}

export const ME_ALIASES = new Set(['me', 'ben', 'i', 'yo', 'ich', 'moi', 'eu', 'you'])

export function participantId(name: string): string {
  return name.trim().toLocaleLowerCase()
}

/** "2", "2s", "1.5 sec", "500ms" → seconds. */
export function parseDuration(s: string | undefined, fallback: number): number {
  if (!s) return fallback
  const m = /^\s*([\d.]+)\s*(ms|milliseconds?|s|sec|secs|seconds?|sn|saniye)?\s*$/i.exec(s)
  if (!m) return fallback
  const v = parseFloat(m[1])
  if (Number.isNaN(v)) return fallback
  return Math.min(LIMITS.directiveSeconds, m[2] && /^ms|^milli/i.test(m[2]) ? v / 1000 : v)
}

/** Alias → canonical tag name. Anything else inside <...> is kept as literal text (e.g. "<3"). */
export const TAG_ALIASES: Record<string, string> = {
  pause: 'pause',
  mid_type_wait: 'pause',
  midtype_wait: 'pause',
  think: 'pause',
  hesitate: 'pause',
  typo: 'typo',
  oops: 'typo',
  mistake: 'mistake',
  wrong: 'mistake',
  typo_text: 'mistake',
  retype: 'mistake',
  del: 'del',
  delete: 'del',
  backspace: 'del',
  clear: 'clear',
  delete_all: 'clear',
  clear_all: 'clear',
  erase: 'clear',
  speed: 'speed',
  fast: 'fast',
  slow: 'slow',
  normal: 'normal',
  react: 'react',
  reaction: 'react',
  tapback: 'react',
  image: 'image',
  photo: 'image',
  img: 'image',
  pic: 'image',
  foto: 'image',
  resim: 'image',
  typing: 'typing',
  wait: 'wait',
  delay: 'wait',
  gap: 'wait',
  hold: 'hold',
  read: 'hold',
  read_time: 'hold',
  instant: 'instant',
  no_typing: 'instant',
  paste: 'instant',
  typing_stop: 'typing_stop',
  fake_typing: 'typing_stop',
  typing_only: 'typing_stop',
  time: 'time',
  timestamp: 'time',
  start: 'start',
  begin: 'start',
  now: 'start',
  live: 'start',
  video_start: 'start',
  history: 'history',
  past: 'history',
  history_start: 'history',
  end_history: 'end_history',
  history_end: 'end_history',
  added: 'added',
  add: 'added',
  joined: 'added',
  removed: 'removed',
  remove: 'removed',
  kicked: 'removed',
  left: 'left',
  leave: 'left',
  renamed: 'renamed',
  rename: 'renamed',
  named: 'renamed',
  group_name: 'renamed',
  group_photo: 'group_photo',
  photo_changed: 'group_photo',
  system: 'system',
  notice: 'system',
}

const RE_ANGLE = /<\s*([a-z_]+)(?:\s*[:=]\s*|\s+)?([^<>]*?)\s*>/gi
const RE_BRACKET = /\[\s*([a-z_]+)(?:\s*[:=]\s*|\s+)?([^[\]]*?)\s*\]/gi
const RE_CURLY = /\{([^{}]+)\}/g
const RE_NAME = /^([^:<>[\]{}#@\n]{1,40}?)\s*:\s?(.*)$/
const RE_TIMESTAMP = /^-{2,}\s*(.*?)\s*-{2,}$/

const REACTION_ALIASES: Record<string, string> = {
  heart: '❤️',
  love: '❤️',
  like: '👍',
  thumbsup: '👍',
  dislike: '👎',
  thumbsdown: '👎',
  haha: 'HAHA',
  lol: 'HAHA',
  emphasize: '‼️',
  '!!': '‼️',
  '!': '‼️',
  question: '❓',
  '?': '❓',
}

function parseReaction(arg: string): Reaction | null {
  const parts = arg.trim().split(/\s+/)
  const token = parts.shift()
  if (!token) return null
  if (parts[0] && /^(by|from|kimden)$/i.test(parts[0])) parts.shift()
  return { emoji: REACTION_ALIASES[token.toLowerCase()] ?? token, from: parts.length ? participantId(parts.join(' ')) : '' }
}

/** Convert legacy [tag ...] to <tag ...> for known tag names. */
function normalizeLegacy(s: string): string {
  return s.replace(RE_BRACKET, (all, name: string, arg: string) => {
    const canon = TAG_ALIASES[name.toLowerCase()]
    if (!canon) return all
    return `<${name}${arg ? ` ${arg}` : ''}>`
  })
}

interface Content {
  ops: TypingOp[]
  text: string
  reactions: Reaction[]
  image: string | null | undefined
  wait?: number
  typing?: number
  hold?: number
  instant?: boolean
  typingStop?: number
}

const graphemeSeg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
function graphemes(s: string): string[] {
  return Array.from(graphemeSeg.segment(s), (x) => x.segment)
}

/** Apply typing ops to get the text that ends up in the bubble. */
export function finalText(ops: TypingOp[]): string {
  let buf: string[] = []
  for (const op of ops) {
    if (op.kind === 'type') buf.push(...graphemes(op.text))
    else if (op.kind === 'del') buf = buf.slice(0, Math.max(0, buf.length - op.count))
    else if (op.kind === 'clear') buf = []
  }
  return buf.join('')
}

function parseContent(content: string): Content {
  const src = normalizeLegacy(content)
  const out: Content = { ops: [], text: '', reactions: [], image: undefined }
  const pushType = (text: string) => {
    if (!text) return
    const last = out.ops[out.ops.length - 1]
    if (last && last.kind === 'type') last.text += text
    else out.ops.push({ kind: 'type', text })
  }
  // Split into text / {reaction} / <tag> tokens.
  const re = new RegExp(`${RE_ANGLE.source}|${RE_CURLY.source}`, 'gi')
  let pos = 0
  for (const m of src.matchAll(re)) {
    const start = m.index ?? 0
    pushType(src.slice(pos, start))
    pos = start + m[0].length
    if (m[3] !== undefined) {
      const r = parseReaction(m[3])
      if (r) out.reactions.push(r)
      continue
    }
    const name = (m[1] ?? '').toLowerCase()
    const arg = (m[2] ?? '').trim()
    const canon = TAG_ALIASES[name]
    switch (canon) {
      case 'pause':
        out.ops.push({ kind: 'pause', seconds: parseDuration(arg, 1) })
        break
      case 'typo':
        out.ops.push({ kind: 'typo' })
        break
      case 'mistake':
        if (arg) out.ops.push({ kind: 'mistake', text: arg })
        break
      case 'del':
        out.ops.push({ kind: 'del', count: Math.max(1, parseInt(arg || '1', 10) || 1) })
        break
      case 'clear':
        out.ops.push({ kind: 'clear' })
        break
      case 'speed':
        out.ops.push({ kind: 'speed', factor: Math.max(0.1, parseFloat(arg) || 1) })
        break
      case 'fast':
        out.ops.push({ kind: 'speed', factor: 1.8 })
        break
      case 'slow':
        out.ops.push({ kind: 'speed', factor: 0.5 })
        break
      case 'normal':
        out.ops.push({ kind: 'speed', factor: 1 })
        break
      case 'react': {
        const r = parseReaction(arg)
        if (r) out.reactions.push(r)
        break
      }
      case 'image':
        out.image = arg ? arg.split(/\s+/)[0] : null
        break
      case 'typing':
        out.typing = parseDuration(arg, 2)
        break
      case 'wait':
        out.wait = (out.wait ?? 0) + parseDuration(arg, 1)
        break
      case 'hold':
        out.hold = parseDuration(arg, 2)
        break
      case 'instant':
        out.instant = true
        break
      case 'typing_stop':
        out.typingStop = parseDuration(arg, 2)
        break
      default:
        pushType(m[0])
    }
  }
  pushType(src.slice(pos))

  // Tidy whitespace around tags: trim the edges and avoid double spaces where a tag was removed.
  const types = out.ops.filter((o): o is { kind: 'type'; text: string } => o.kind === 'type')
  if (types.length) {
    types[0].text = types[0].text.replace(/^[ \t]+/, '')
    types[types.length - 1].text = types[types.length - 1].text.replace(/[ \t]+$/, '')
  }
  let prevEndsSpace = false
  for (const op of out.ops) {
    if (op.kind !== 'type') continue
    if (prevEndsSpace) op.text = op.text.replace(/^[ \t]+/, '')
    prevEndsSpace = /[ \t]$/.test(op.text)
  }
  out.ops = out.ops.filter((o) => o.kind !== 'type' || o.text.length > 0)
  out.text = finalText(out.ops)
  return out
}

/** True when the line only contains tags (no message text). */
function onlyTags(line: string): boolean {
  const src = normalizeLegacy(line)
  if (!/[<]/.test(src)) return false
  let rest = src
  for (const m of src.matchAll(RE_ANGLE)) {
    if (!TAG_ALIASES[(m[1] ?? '').toLowerCase()]) return false
    rest = rest.replace(m[0], '')
  }
  return rest.trim() === ''
}

const SYSTEM_TAGS: Record<string, SystemEvent['type']> = {
  added: 'added',
  removed: 'removed',
  left: 'left',
  renamed: 'renamed',
  group_photo: 'photo',
  system: 'custom',
}

function unquote(s: string): string {
  return s
    .trim()
    .replace(/^["“”'«»„‚‘’]+|["“”'«»„‚‘’]+$/g, '')
    .trim()
}

/** "<added Can by Ayşe>" → { type: 'added', target: 'Can', actor: 'Ayşe' }. No "by" = I did it. */
function parseSystem(canon: string, arg: string): SystemEvent {
  const type = SYSTEM_TAGS[canon]
  if (type === 'custom') return { type, text: arg }
  const lead = /^(?:by|from|tarafından|kimden)\s+(.+)$/i.exec(arg.trim())
  const m = lead ? null : /^(.*?)\s+(?:by|from|tarafından|kimden)\s+(.+)$/i.exec(arg)
  const main = lead ? '' : unquote(m ? m[1] : arg)
  const actor = lead ? unquote(lead[1]) : m ? unquote(m[2]) : ''
  if (type === 'left') return { type, actor: main || actor }
  if (type === 'photo') return { type, actor: actor || main }
  if (type === 'renamed') return { type, text: main, actor }
  return { type, target: main, actor }
}

/** "@avatar Ayşe Yılmaz 🦋 #ffb3c1" */
function parseAvatar(v: string): { name: string; emoji: string; color?: string } | null {
  const parts = v.trim().split(/\s+/)
  let color: string | undefined
  if (parts.length && /^#[0-9a-f]{3,8}$/i.test(parts[parts.length - 1])) color = parts.pop()
  const emoji = parts.pop()
  if (!emoji || !parts.length) return null
  return { name: parts.join(' '), emoji, color }
}

export function parseScript(src: string): ParseResult {
  const lines = src.split(/\r?\n/)
  const messages: Message[] = []
  const names: string[] = []
  const seen = new Set<string>()
  const errors: ScriptError[] = []
  const settings: Record<string, string> = {}
  const avatars: ParseResult['avatars'] = []
  let pending: { wait?: number; typing?: number; hold?: number; instant?: boolean } = {}
  let blockStart = -1
  let last: Message | null = null
  let historyMode = false

  const addName = (name: string) => {
    const id = participantId(name)
    if (!seen.has(id)) {
      seen.add(id)
      names.push(name)
    }
    return id
  }

  const take = (m: Omit<Message, 'blockStart'>): Message => {
    const msg: Message = {
      ...m,
      wait: (pending.wait ?? 0) + (m.wait ?? 0) || undefined,
      typing: m.typing ?? pending.typing,
      hold: m.hold ?? pending.hold,
      instant: m.instant || pending.instant || undefined,
      history: historyMode || undefined,
      blockStart: blockStart >= 0 ? blockStart : m.line,
    }
    pending = {}
    blockStart = -1
    messages.push(msg)
    return msg
  }

  const buildMessage = (i: number, fromId: string, raw: string): Omit<Message, 'blockStart'> => {
    const c = parseContent(raw)
    if (c.typingStop !== undefined || (!c.text && c.image === undefined && !c.ops.some((o) => o.kind === 'type' || o.kind === 'mistake'))) {
      return { id: `m${i}`, kind: 'typing', from: fromId, raw, typing: c.typingStop ?? c.typing ?? 2, wait: c.wait, line: i, lineEnd: i }
    }
    if (c.image !== undefined) {
      return {
        id: `m${i}`,
        kind: 'image',
        from: fromId,
        image: c.image,
        text: c.text,
        raw,
        reactions: c.reactions,
        wait: c.wait,
        typing: c.typing,
        hold: c.hold,
        instant: c.instant,
        line: i,
        lineEnd: i,
      }
    }
    return {
      id: `m${i}`,
      kind: 'text',
      from: fromId,
      text: c.text,
      raw,
      ops: c.ops,
      reactions: c.reactions,
      wait: c.wait,
      typing: c.typing,
      hold: c.hold,
      instant: c.instant,
      line: i,
      lineEnd: i,
    }
  }

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim()
    if (!line) {
      last = null
      return
    }
    if (line.startsWith('#') || line.startsWith('//')) return

    if (line.startsWith('@')) {
      const m = /^@\s*([a-z_]+)\s*[:=]?\s*(.*)$/i.exec(line)
      if (m && m[1].toLowerCase() === 'avatar') {
        const a = parseAvatar(m[2])
        if (a) avatars.push(a)
      } else if (m) settings[m[1].toLowerCase()] = m[2].trim()
      last = null
      return
    }

    const ts = RE_TIMESTAMP.exec(line)
    if (ts) {
      last = null
      take({ id: `m${i}`, kind: 'timestamp', text: ts[1], line: i, lineEnd: i })
      return
    }

    if (/^<\/\s*history\s*>$/i.test(line)) {
      historyMode = false
      last = null
      return
    }

    if (onlyTags(line)) {
      last = null
      if (blockStart < 0) blockStart = i
      for (const m of normalizeLegacy(line).matchAll(RE_ANGLE)) {
        const canon = TAG_ALIASES[(m[1] ?? '').toLowerCase()]
        const arg = (m[2] ?? '').trim()
        if (canon === 'typing') pending.typing = parseDuration(arg, 2)
        else if (canon === 'hold') pending.hold = parseDuration(arg, 2)
        else if (canon === 'instant') pending.instant = true
        else if (canon === 'wait' || canon === 'pause') pending.wait = (pending.wait ?? 0) + parseDuration(arg, 1)
        else if (canon === 'time') take({ id: `m${i}`, kind: 'timestamp', text: arg, line: i, lineEnd: i })
        else if (canon && SYSTEM_TAGS[canon]) take({ id: `m${i}`, kind: 'system', system: parseSystem(canon, arg), line: i, lineEnd: i })
        else if (canon === 'history') historyMode = true
        else if (canon === 'end_history') historyMode = false
        else if (canon === 'start') {
          // Everything above <start> is already on screen when the video begins.
          for (const m of messages) m.history = true
          historyMode = false
        } else if (canon === 'typing_stop') {
          // <typing_stop 2s> or <typing_stop Jessica 2s>
          const parts = arg.split(/\s+/).filter(Boolean)
          const durTok = parts.length && /^[\d.]+\s*(ms|s|sec|secs|seconds?)?$/i.test(parts[parts.length - 1]) ? parts.pop() : undefined
          const who = parts.join(' ')
          const id = who ? addName(who) : ''
          take({ id: `m${i}`, kind: 'typing', from: id, typing: parseDuration(durTok, 2), line: i, lineEnd: i })
        }
      }
      return
    }

    const nm = RE_NAME.exec(line)
    const looksLikeName = nm && !nm[2].startsWith('//') && !/^\d+$/.test(nm[1].trim())
    if (nm && looksLikeName) {
      const id = addName(nm[1].trim())
      last = take(buildMessage(i, id, nm[2]))
      return
    }

    // Continuation of the previous text message.
    const prev = last as Message | null
    if (prev && prev.kind === 'text') {
      const raw = `${prev.raw ?? ''}\n${line}`
      const rebuilt = buildMessage(prev.line, prev.from ?? '', raw)
      Object.assign(prev, { ...rebuilt, id: prev.id, wait: prev.wait, typing: prev.typing ?? rebuilt.typing, hold: prev.hold ?? rebuilt.hold, lineEnd: i })
      return
    }
    errors.push({ line: i, message: 'Start the line with a name, e.g. "Me: hello"' })
  })

  if (pending.wait) {
    messages.push({
      id: 'pause-end',
      kind: 'pause',
      wait: pending.wait,
      line: lines.length - 1,
      lineEnd: lines.length - 1,
      blockStart: blockStart >= 0 ? blockStart : lines.length - 1,
    })
  }

  return { messages, names, errors, settings, avatars }
}

// ---------------------------------------------------------------- editing helpers

function nameOf(id: string | undefined, participants: Participant[]): string {
  return participants.find((x) => x.id === id)?.name ?? id ?? 'Me'
}

/** Script lines for a message body (no directive lines). */
export function messageLines(m: Pick<Message, 'kind' | 'from' | 'raw' | 'text' | 'image'>, participants: Participant[]): string[] {
  if (m.kind === 'timestamp') return [`--- ${m.text ?? ''} ---`]
  const raw = m.raw ?? (m.kind === 'image' ? (m.image ? `<image:${m.image}>` : '<image>') : (m.text ?? ''))
  const [first, ...rest] = raw.split('\n')
  return [`${nameOf(m.from, participants)}: ${first}`, ...rest]
}

/** Replace the body lines of a message (keeps its directive lines). */
export function replaceMessageBody(src: string, m: Message, next: string[]): string {
  const lines = src.split(/\r?\n/)
  lines.splice(m.line, m.lineEnd - m.line + 1, ...next)
  return lines.join('\n')
}

/** Remove a message including its directive lines. */
export function deleteMessage(src: string, m: Message): string {
  const lines = src.split(/\r?\n/)
  lines.splice(m.blockStart, m.lineEnd - m.blockStart + 1)
  return lines.join('\n')
}

export function insertLinesAfter(src: string, m: Message | null, next: string[]): string {
  const lines = src.split(/\r?\n/)
  if (!m) {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    lines.push(...next)
    return lines.join('\n')
  }
  lines.splice(m.lineEnd + 1, 0, ...next)
  return lines.join('\n')
}

export function moveMessage(src: string, messages: Message[], index: number, dir: -1 | 1): string {
  const a = messages[index]
  const b = messages[index + dir]
  if (!a || !b) return src
  const lines = src.split(/\r?\n/)
  const [first, second] = dir === 1 ? [a, b] : [b, a]
  const firstLines = lines.slice(first.blockStart, first.lineEnd + 1)
  const between = lines.slice(first.lineEnd + 1, second.blockStart)
  const secondLines = lines.slice(second.blockStart, second.lineEnd + 1)
  lines.splice(first.blockStart, second.lineEnd - first.blockStart + 1, ...secondLines, ...between, ...firstLines)
  return lines.join('\n')
}

/** Set (or add) an @setting line at the top of the script. */
export function setScriptSetting(src: string, key: string, value: string | null): string {
  const lines = src.split(/\r?\n/)
  const re = new RegExp(`^\\s*@\\s*${key}\\b`, 'i')
  const idx = lines.findIndex((l) => re.test(l))
  if (value === null) {
    if (idx >= 0) lines.splice(idx, 1)
    return lines.join('\n')
  }
  if (idx >= 0) lines[idx] = `@${key} ${value}`
  else lines.unshift(`@${key} ${value}`)
  return lines.join('\n')
}
