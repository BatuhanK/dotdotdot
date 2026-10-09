import { messageLines, parseScript, TAG_ALIASES } from './script'
import type { Message, Participant, Reaction, SystemEvent } from './types'

/*
 * Script rewriting for the visual message editor. The script stays the source of truth: every edit
 * regenerates a message's lines. A message "block" is its directive lines (tags on their own lines
 * right above it) plus its body lines. Markers in a block (<start>, <history>) and comments are kept.
 */

const RE_TAG = /<\s*([a-z_]+)(?:\s*[:=]\s*|\s+)?([^<>]*?)\s*>/gi
const RE_LEGACY = /\[\s*([a-z_]+)(?:\s*[:=]\s*|\s+)?([^[\]]*?)\s*\]/gi
const RE_CURLY = /\{[^{}]+\}/g
const RE_MARKER = /<\s*\/?\s*(start|begin|now|live|video_start|history|past|history_start|end_history|history_end)\s*>/i

/** Tags on directive lines that set the next message's timing. */
const LINE_TIMING = new Set(['wait', 'pause', 'typing', 'hold', 'instant'])
/** The same, written inside a message (an inline <pause> is a typing pause, so it stays). */
const BODY_TIMING = new Set(['wait', 'typing', 'hold', 'instant'])
const START = new Set(['start'])
const SPEED = new Set(['speed', 'fast', 'slow', 'normal'])
const TRAILING_CLEAR = /\s*<\s*(clear|delete_all|clear_all|erase)\s*>\s*$/i

export interface MessageTiming {
  /** Seconds to wait before the message. */
  wait?: number
  /** Typing time (their typing bubble / my keyboard), seconds. Undefined = automatic. */
  typing?: number
  /** Reading time after it appears, seconds. Undefined = automatic. */
  hold?: number
  /** My message pops in without being typed. */
  instant?: boolean
}

export type TypingSpeed = 'slow' | 'normal' | 'fast'

const sec = (v: number) => `${Math.round(v * 10) / 10}s`

/** Remove tags whose canonical name is in `names` (both <tag> and legacy [tag]). */
export function stripTags(s: string, names: ReadonlySet<string>): string {
  const drop = (all: string, name: string) => (names.has(TAG_ALIASES[name.toLowerCase()] ?? '') ? '' : all)
  return tidy(s.replace(RE_TAG, drop).replace(RE_LEGACY, drop))
}

function tidy(s: string): string {
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
    .trim()
}

function nameOf(id: string | undefined, participants: Participant[]): string {
  return participants.find((p) => p.id === id)?.name ?? id ?? ''
}

export function systemTag(e: SystemEvent, participants: Participant[] = []): string {
  const by = e.actor ? ` by ${nameOf(e.actor, participants) || e.actor}` : ''
  switch (e.type) {
    case 'added':
      return `<added ${e.target ?? ''}${by}>`
    case 'removed':
      return `<removed ${e.target ?? ''}${by}>`
    case 'left':
      return e.actor ? `<left ${e.actor}>` : '<left>'
    case 'renamed':
      return `<renamed "${e.text ?? ''}"${by}>`
    case 'photo':
      return `<group_photo${by}>`
    default:
      return `<system ${e.text ?? ''}>`
  }
}

/** Script lines of a message body, for every message kind. */
export function bodyLines(m: Message, participants: Participant[]): string[] {
  if (m.kind === 'system' && m.system) return [systemTag(m.system, participants)]
  if (m.kind === 'typing') return [['<typing_stop', nameOf(m.from, participants), `${sec(m.typing ?? 2)}>`].filter(Boolean).join(' ')]
  return messageLines(m, participants)
}

/** Replace a message (and optionally its timing). Markers like <start> and comments above it stay. */
export function rewriteMessage(src: string, m: Message, next: Message, participants: Participant[], timing?: MessageTiming): string {
  const lines = src.split(/\r?\n/)
  let block = lines.slice(m.blockStart, m.line)
  let body = bodyLines(next, participants)
  if (timing) {
    block = block.map((l) => (/^\s*(#|\/\/)/.test(l) ? l : stripTags(l, LINE_TIMING))).filter((l) => l.trim())
    const tags = [
      timing.wait ? `<wait ${sec(timing.wait)}>` : '',
      timing.typing !== undefined && next.kind !== 'typing' ? `<typing ${sec(timing.typing)}>` : '',
      timing.hold !== undefined ? `<hold ${sec(timing.hold)}>` : '',
      timing.instant ? '<instant>' : '',
    ].filter(Boolean)
    if (next.kind === 'text' || next.kind === 'image') body = bodyLines({ ...next, raw: stripTags(next.raw ?? '', BODY_TIMING) }, participants)
    if (tags.length) block.push(tags.join(' '))
  }
  lines.splice(m.blockStart, m.lineEnd - m.blockStart + 1, ...block, ...body)
  return lines.join('\n')
}

/** Remove a message with its timing lines; markers and comments above it stay. */
export function removeMessage(src: string, m: Message): string {
  const lines = src.split(/\r?\n/)
  const keep = lines
    .slice(m.blockStart, m.line)
    .map((l) => (/^\s*(#|\/\/)/.test(l) ? l : stripTags(l, LINE_TIMING)))
    .filter((l) => l.trim())
  lines.splice(m.blockStart, m.lineEnd - m.blockStart + 1, ...keep)
  return lines.join('\n')
}

/** A message's own lines (timing + body) without markers. */
function ownLines(lines: string[], m: Message): string[] {
  const block = lines
    .slice(m.blockStart, m.line)
    .map((l) => (RE_MARKER.test(l) ? stripTags(l, new Set(['start', 'history', 'end_history'])) : l))
    .filter((l) => l.trim())
  return [...block, ...lines.slice(m.line, m.lineEnd + 1)]
}

/**
 * Where new lines go when inserting at `index` (0 = before the first message, messages.length = at the
 * end). `afterMarkers` puts them below a <start> marker that sits right above message `index`.
 */
function insertPos(lines: string[], messages: Message[], index: number, afterMarkers: boolean): number {
  if (afterMarkers && index < messages.length) {
    const m = messages[index]
    let pos = m.blockStart
    for (let i = m.blockStart; i < m.line; i++) if (RE_MARKER.test(lines[i])) pos = i + 1
    return pos
  }
  if (index <= 0) return messages[0]?.blockStart ?? lines.length
  return messages[Math.min(index, messages.length) - 1].lineEnd + 1
}

export function insertAt(src: string, messages: Message[], index: number, newLines: string[], afterMarkers = false): string {
  const lines = src.split(/\r?\n/)
  if (index >= messages.length && !afterMarkers) {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    lines.push(...newLines)
    return lines.join('\n')
  }
  lines.splice(insertPos(lines, messages, index, afterMarkers), 0, ...newLines)
  return lines.join('\n')
}

export function duplicateMessage(src: string, m: Message): string {
  const lines = src.split(/\r?\n/)
  lines.splice(m.lineEnd + 1, 0, ...ownLines(lines, m))
  return lines.join('\n')
}

/** Move message `from` up or down one place. Markers stay where they are. */
export function moveMessageBy(src: string, messages: Message[], from: number, dir: -1 | 1): string {
  const m = messages[from]
  const to = from + dir
  if (!m || to < 0 || to >= messages.length) return src
  const moved = ownLines(src.split(/\r?\n/), m)
  const without = removeMessage(src, m)
  const rest = parseScript(without).messages
  // Moving up: before the message that was above (below its markers so live stays live).
  // Moving down: after the message that was below.
  return dir === -1 ? insertAt(without, rest, to, moved, true) : insertAt(without, rest, to + 1, moved)
}

/** Make the video start after message `index` (everything up to it is on screen at the start). null = no history. */
export function setVideoStart(src: string, index: number | null): string {
  const cleaned = src
    .split(/\r?\n/)
    .flatMap((l) => {
      if (!/<\s*(start|begin|now|live|video_start)\s*>/i.test(l)) return [l]
      const rest = stripTags(l, START)
      return rest ? [rest] : []
    })
    .join('\n')
  if (index === null) return cleaned
  const messages = parseScript(cleaned).messages
  const lines = cleaned.split(/\r?\n/)
  lines.splice(messages[index].lineEnd + 1, 0, '<start>')
  return lines.join('\n')
}

// ---------------------------------------------------------------- message content helpers

export function withReactions(raw: string, reactions: Reaction[], participants: Participant[]): string {
  const base = stripTags(raw.replace(RE_CURLY, ''), new Set(['react']))
  const tags = reactions.map((r) => `<react ${r.emoji === 'HAHA' ? 'haha' : r.emoji}${r.from ? ` ${nameOf(r.from, participants)}` : ''}>`)
  return [base, ...tags].filter(Boolean).join(' ')
}

/** Typed and then deleted: the message is never sent. */
export function isNeverSent(m: Message): boolean {
  return m.kind === 'text' && m.ops?.[m.ops.length - 1]?.kind === 'clear'
}

export function setNeverSent(raw: string, on: boolean): string {
  const base = raw.replace(TRAILING_CLEAR, '').trim()
  return on ? `${base} <clear>` : base
}

export function speedOf(m: Message): TypingSpeed {
  const op = m.ops?.find((o) => o.kind === 'speed')
  if (!op || op.kind !== 'speed') return 'normal'
  return op.factor < 1 ? 'slow' : op.factor > 1 ? 'fast' : 'normal'
}

export function setSpeed(raw: string, speed: TypingSpeed): string {
  const base = stripTags(raw, SPEED)
  return speed === 'normal' ? base : `<${speed}> ${base}`
}

/** What I typed before deleting everything (for messages that are never sent). */
export function typedBeforeClear(m: Message): string {
  let text = ''
  let shown = ''
  for (const op of m.ops ?? []) {
    if (op.kind === 'type') shown += op.text
    else if (op.kind === 'clear') {
      text = shown || text
      shown = ''
    }
  }
  return text
}

/** Small facts about a message's typing choreography, for the chips under a bubble. */
export function choreography(m: Message): { typos: number; mistakes: number; pauses: number } {
  const ops = m.ops ?? []
  return {
    typos: ops.filter((o) => o.kind === 'typo').length,
    mistakes: ops.filter((o) => o.kind === 'mistake' || o.kind === 'del').length,
    pauses: ops.filter((o) => o.kind === 'pause').length,
  }
}
