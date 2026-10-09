import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Clock3, Copy, Flag, ImagePlus, MessageCircle, Plus, Trash2, Users, X } from 'lucide-react'
import { addAsset, getImage } from '../lib/assets'
import { CHAT_STRINGS } from '../lib/i18n'
import {
  choreography,
  duplicateMessage,
  insertAt,
  isNeverSent,
  moveMessageBy,
  removeMessage,
  rewriteMessage,
  setNeverSent,
  setSpeed,
  setVideoStart,
  speedOf,
  typedBeforeClear,
  withReactions,
  type MessageTiming,
  type TypingSpeed,
} from '../lib/message-edit'
import { itemStart } from '../lib/playhead'
import { ME_ALIASES, parseScript, participantId, TAG_ALIASES } from '../lib/script'
import { useStore } from '../lib/store'
import type { TimedItem } from '../lib/timeline'
import type { Message, Participant, Reaction, SystemEvent } from '../lib/types'
import { useT } from '../lib/ui-i18n'
import { Avatar } from './People'
import { inputCls, rangeFill, Segmented, Toggle } from './ui'

const QUICK_REACTIONS = ['❤️', '👍', '👎', 'HAHA', '‼️', '❓']
const SYSTEM_TYPES: SystemEvent['type'][] = ['added', 'removed', 'left', 'renamed', 'photo', 'custom']

type T = ReturnType<typeof useT>
type InsertKind = 'message' | 'photo' | 'timestamp' | 'typing' | 'system'

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

const round = (v: number) => Math.round(v * 10) / 10

// ---------------------------------------------------------------- the text box (tags shown as colored chips)

const RE_INLINE = /<\s*([a-z_]+)(?:\s*[:=]\s*|\s+)?[^<>]*?\s*>|\{[^{}]+\}/gi

function highlightRaw(raw: string): ReactNode[] {
  const out: ReactNode[] = []
  let pos = 0
  for (const m of raw.matchAll(RE_INLINE)) {
    const at = m.index ?? 0
    if (at > pos) out.push(raw.slice(pos, at))
    const canon = m[1] ? TAG_ALIASES[m[1].toLowerCase()] : 'react'
    out.push(
      canon ? (
        <span key={at} className={canon === 'react' ? 'hl-react' : 'hl-tag'}>
          {m[0]}
        </span>
      ) : (
        m[0]
      ),
    )
    pos = at + m[0].length
  }
  out.push(raw.slice(pos))
  return out
}

/** A textarea over a highlighted copy of its text, so tags show as chips while staying editable. */
function RawEditor({ value, onChange, inputRef }: { value: string; onChange: (v: string) => void; inputRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const shared = 'px-3 py-2.5 font-rounded text-[14px] leading-relaxed break-words whitespace-pre-wrap'
  return (
    <div className="relative rounded-xl bg-white ring-1 ring-ink/10 focus-within:ring-2 focus-within:ring-honey/60">
      <pre aria-hidden className={`m-0 min-h-[2.75rem] text-ink ${shared}`}>
        {highlightRaw(value)}
        {'​'}
      </pre>
      <textarea
        ref={inputRef}
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className={`absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-ink outline-none ${shared}`}
      />
    </div>
  )
}

// ---------------------------------------------------------------- small pieces

function Chip({ children, tone = 'ink' }: { children: ReactNode; tone?: 'ink' | 'honey' | 'pink' }) {
  const tones = { ink: 'bg-ink/[0.05] text-ink/55', honey: 'bg-butter text-[#8A5300]', pink: 'bg-blush text-[#B0245A]' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-4 font-semibold whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-bold tracking-wide text-ink/45 uppercase">{children}</div>
}

function PeoplePills({ people, value, onChange, noneLabel }: { people: Participant[]; value: string; onChange: (id: string) => void; noneLabel?: string }) {
  const pill = (on: boolean) =>
    `flex items-center gap-1.5 rounded-full text-xs font-bold transition ${on ? 'bg-ink text-white' : 'bg-ink/[0.05] text-ink/60 hover:text-ink'}`
  return (
    <div className="flex flex-wrap gap-1.5">
      {noneLabel !== undefined && (
        <button type="button" onClick={() => onChange('')} className={`${pill(value === '')} px-2.5 py-1`}>
          {noneLabel}
        </button>
      )}
      {people.map((p) => (
        <button key={p.id} type="button" onClick={() => onChange(p.id)} className={`${pill(value === p.id)} py-0.5 pr-2.5 pl-0.5`}>
          <Avatar asset={p.avatar} name={p.name} size={20} emoji={p.emoji} color={p.color} />
          {p.name}
        </button>
      ))}
    </div>
  )
}

/** A seconds slider with an optional "Auto" (undefined) state. */
function SecondsSlider(props: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  min: number
  max: number
  autoLabel?: string
  fallback: number
}) {
  const auto = props.value === undefined
  const v = props.value ?? props.fallback
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-ink/60">
        <span>{props.label}</span>
        <span className="flex items-center gap-2">
          {props.autoLabel && (
            <button
              type="button"
              onClick={() => props.onChange(auto ? props.fallback : undefined)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition ${auto ? 'bg-honey text-ink' : 'bg-ink/[0.05] text-ink/45 hover:text-ink'}`}
            >
              {props.autoLabel}
            </button>
          )}
          <span className={`w-12 text-right tabular-nums ${auto ? 'text-ink/35' : 'text-ink'}`}>{auto ? '—' : `${round(v)}s`}</span>
        </span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={0.1}
        value={v}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
        className={`sweet-range w-full ${auto ? 'opacity-40' : ''}`}
        style={rangeFill(v, props.min, props.max)}
      />
    </div>
  )
}

function describeSystem(e: SystemEvent, participants: Participant[], strings: (typeof CHAT_STRINGS)[keyof typeof CHAT_STRINGS], meName: string): string {
  if (e.type === 'custom') return e.text ?? ''
  const person = (n?: string) => {
    if (!n) return { name: meName, me: true }
    const id = participantId(n)
    const p = participants.find((x) => x.id === id)
    return { name: p?.name ?? n, me: !!p?.isMe || ME_ALIASES.has(id) }
  }
  const actor = person(e.actor)
  const pick = (other: string, mine: string) => (actor.me ? mine : other)
  const tpl =
    e.type === 'added'
      ? pick(strings.sysAdded, strings.sysAddedMe)
      : e.type === 'removed'
        ? pick(strings.sysRemoved, strings.sysRemovedMe)
        : e.type === 'left'
          ? pick(strings.sysLeft, strings.sysLeftMe)
          : e.type === 'renamed'
            ? pick(strings.sysRenamed, strings.sysRenamedMe)
            : pick(strings.sysPhoto, strings.sysPhotoMe)
  return tpl
    .replace('{actor}', actor.name)
    .replace('{target}', person(e.target).name)
    .replace('{name}', e.text ?? '')
}

// ---------------------------------------------------------------- "+" between messages

function InsertRow({ onPick, open, setOpen, t }: { onPick: (kind: InsertKind) => void; open: boolean; setOpen: (v: boolean) => void; t: T }) {
  const items: { kind: InsertKind; label: string; icon: ReactNode }[] = [
    { kind: 'message', label: t('insMessage'), icon: <MessageCircle className="h-3.5 w-3.5" /> },
    { kind: 'photo', label: t('insPhoto'), icon: <ImagePlus className="h-3.5 w-3.5" /> },
    { kind: 'timestamp', label: t('insTimestamp'), icon: <Clock3 className="h-3.5 w-3.5" /> },
    { kind: 'typing', label: t('insTyping'), icon: <span className="text-[11px] leading-none font-black tracking-tighter">•••</span> },
    { kind: 'system', label: t('insSystem'), icon: <Users className="h-3.5 w-3.5" /> },
  ]
  const line = `h-px flex-1 transition ${open ? 'bg-honey' : 'bg-transparent group-hover/ins:bg-honey/60'}`
  return (
    <div className={`group/ins relative flex h-4 items-center ${open ? 'z-20' : ''}`} onClick={(e) => e.stopPropagation()}>
      <div className={line} />
      <button
        type="button"
        title={t('msgInsert')}
        onClick={() => setOpen(!open)}
        className={`mx-1 grid h-5 w-5 place-items-center rounded-full transition ${open ? 'bg-honey text-ink' : 'bg-white text-ink/50 opacity-0 shadow-sm ring-1 ring-ink/10 group-hover/ins:opacity-100 [@media(hover:none)]:opacity-50'}`}
      >
        <Plus className="h-3 w-3" strokeWidth={3} />
      </button>
      <div className={line} />
      {open && (
        <div className="pop-in absolute top-5 left-1/2 flex w-[300px] -translate-x-1/2 flex-wrap justify-center gap-1 rounded-2xl bg-white p-1.5 shadow-[0_12px_30px_-12px_rgba(60,40,0,0.45)] ring-1 ring-ink/10">
          {items.map((x) => (
            <button
              key={x.kind}
              type="button"
              onClick={() => onPick(x.kind)}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold text-ink/70 transition hover:bg-butter hover:text-ink"
            >
              {x.icon} {x.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- the list

export function MessageList() {
  const t = useT()
  const parsed = useStore((s) => s.parsed)
  const participants = useStore((s) => s.participants)
  const timeline = useStore((s) => s.timeline)
  const effective = useStore((s) => s.effective)
  const selectedId = useStore((s) => s.selectedId)
  const playing = useStore((s) => s.playing)
  const update = useStore((s) => s.update)
  const jumpTo = useStore((s) => s.jumpTo)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [draftFrom, setDraftFrom] = useState('')

  const messages = parsed.messages
  const others = participants.filter((p) => !p.isMe)
  const group = others.length > 1 || effective.chat.group
  const fromId = participants.some((p) => p.id === draftFrom) ? draftFrom : participants.find((p) => p.isMe)?.id || participants[0]?.id || ''
  const strings = CHAT_STRINGS[effective.locale]
  const firstLive = messages.findIndex((m) => !m.history && m.kind !== 'pause')
  const hasHistory = messages.some((m) => m.history)

  // Follow the video: keep the playing (selected) message in view, unless the user is editing in here.
  useEffect(() => {
    if (!selectedId || listRef.current?.contains(document.activeElement)) return
    listRef.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest', behavior: playing ? 'smooth' : 'auto' })
  }, [selectedId, playing])

  /** Apply a script edit; optionally open (and select) the message at `focus` afterwards. */
  const edit = (fn: (src: string, msgs: Message[]) => string, focus?: number | null, coalesce?: string) => {
    update((p) => ({ ...p, script: fn(p.script, parseScript(p.script).messages) }), coalesce)
    if (focus === undefined) return
    setOpen(focus)
    const id = focus === null ? null : useStore.getState().parsed.messages[focus]?.id
    if (id) useStore.getState().select(id)
  }

  const rewrite = (idx: number, patch: Partial<Message>, timing?: MessageTiming, coalesce?: string) =>
    edit(
      (src, msgs) => {
        const m = msgs[idx]
        return m ? rewriteMessage(src, m, { ...m, ...patch }, participants, timing) : src
      },
      undefined,
      coalesce,
    )

  const nameOf = (id?: string) => participants.find((p) => p.id === id)?.name ?? ''
  /** Who probably speaks next: the person after the previous speaker. */
  const nextSpeaker = (idx: number) => {
    const prev = messages
      .slice(0, idx)
      .reverse()
      .find((m) => m.from)
    if (!prev?.from || participants.length < 2) return fromId
    const i = participants.findIndex((p) => p.id === prev.from)
    return participants[(i + 1) % participants.length].id
  }

  const insert = (index: number, afterMarkers: boolean, kind: InsertKind) => {
    setMenu(null)
    const speaker = nameOf(nextSpeaker(index)) || 'Me'
    const other = others[0]?.name ?? 'Jessica'
    const line =
      kind === 'message'
        ? `${speaker}: ${t('newMessageText')}`
        : kind === 'photo'
          ? `${speaker}: <image>`
          : kind === 'timestamp'
            ? `--- Today ${effective.chat.clock || '9:41'} ---`
            : kind === 'typing'
              ? `<typing_stop ${other} 2s>`
              : `<added ${t('newPerson')}>`
    edit((src, msgs) => insertAt(src, msgs, index, [line], afterMarkers), index)
  }

  const addFromComposer = () => {
    if (!draft.trim() || !fromId) return
    const line = `${nameOf(fromId) || 'Me'}: ${draft.trim()}`
    edit((src, msgs) => insertAt(src, msgs, msgs.length, [line]))
    setDraft('')
    // Show the new message in the preview.
    const added = useStore
      .getState()
      .parsed.messages.filter((m) => m.kind !== 'pause')
      .pop()
    if (added) useStore.getState().jumpTo(added.id)
  }

  const itemOf = (id: string): TimedItem | undefined => timeline.items.find((i) => i.msg.id === id)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-6" onClick={() => setMenu(null)}>
        {messages.map((m, idx) => {
          if (m.kind === 'pause') return null
          const startHere = hasHistory && idx === firstLive
          return (
            <Fragment key={m.id}>
              <InsertRow t={t} open={menu === `${idx}`} setOpen={(v) => setMenu(v ? `${idx}` : null)} onPick={(k) => insert(idx, false, k)} />
              {startHere && (
                <>
                  <div className="my-1 flex items-center gap-2 text-[11px] font-bold text-[#8A5300]" title={t('msgVideoStartsHint')}>
                    <span className="h-0.5 flex-1 rounded-full bg-[repeating-linear-gradient(90deg,#FFB800_0_6px,transparent_6px_10px)]" />
                    <span className="flex items-center gap-1 rounded-full bg-butter py-1 pr-1 pl-2.5">
                      ▶ {t('msgVideoStarts')}
                      <button
                        type="button"
                        title={t('msgRemoveStart')}
                        onClick={() => edit((src) => setVideoStart(src, null), null)}
                        className="rounded-full p-0.5 text-[#8A5300]/60 hover:bg-white hover:text-[#8A5300]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                    <span className="h-0.5 flex-1 rounded-full bg-[repeating-linear-gradient(90deg,#FFB800_0_6px,transparent_6px_10px)]" />
                  </div>
                  <InsertRow t={t} open={menu === `${idx}-l`} setOpen={(v) => setMenu(v ? `${idx}-l` : null)} onPick={(k) => insert(idx, true, k)} />
                </>
              )}
              <Row
                m={m}
                item={itemOf(m.id)}
                participants={participants}
                group={group}
                app={effective.app}
                sms={effective.chat.service === 'sms'}
                selected={m.id === selectedId}
                playing={playing}
                open={open === idx}
                describe={(e) => describeSystem(e, participants, strings, t('me'))}
                onClick={() => {
                  jumpTo(m.id)
                  setOpen(open === idx ? null : idx)
                }}
                t={t}
              />
              {open === idx && (
                <Editor
                  key={m.id}
                  m={m}
                  idx={idx}
                  count={messages.length}
                  participants={participants}
                  t={t}
                  onClose={() => setOpen(null)}
                  rewrite={rewrite}
                  edit={edit}
                />
              )}
            </Fragment>
          )
        })}
        <InsertRow t={t} open={menu === 'end'} setOpen={(v) => setMenu(v ? 'end' : null)} onPick={(k) => insert(messages.length, false, k)} />
      </div>

      {/* composer: pick who speaks, type, Enter */}
      <div className="border-t border-ink/[0.06] p-2.5">
        <div className="mb-2 flex flex-wrap gap-1">
          {participants.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setDraftFrom(p.id)}
              className={`flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-[11px] font-bold transition ${p.id === fromId ? 'bg-ink text-white' : 'bg-ink/[0.05] text-ink/55 hover:text-ink'}`}
            >
              <Avatar asset={p.avatar} name={p.name} size={18} emoji={p.emoji} color={p.color} />
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-ink/10 bg-cream p-1 pl-3 transition focus-within:border-honey focus-within:bg-white">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFromComposer()}
            placeholder={t('typeMessage')}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/35"
          />
          <button
            type="button"
            title={t('addMessage')}
            onClick={addFromComposer}
            className="grid h-8 w-8 place-items-center rounded-full bg-honey text-ink transition hover:bg-sun"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- one message, drawn like the chat

function Row(props: {
  m: Message
  item: TimedItem | undefined
  participants: Participant[]
  group: boolean
  app: string
  sms: boolean
  selected: boolean
  playing: boolean
  open: boolean
  describe: (e: SystemEvent) => string
  onClick: () => void
  t: T
}) {
  const { m, item, participants, group, selected, t } = props
  const ring = selected ? 'ring-2 ring-honey ring-offset-2 ring-offset-white' : ''
  const now = selected && props.playing && <span className="absolute top-1/2 -left-1.5 h-2 w-2 -translate-y-1/2 animate-ping rounded-full bg-honey" />
  // When it starts in the video (history messages are simply on screen from the start).
  const at = item && item.appearAt >= 0 && <span className="text-[10px] font-semibold text-ink/30 tabular-nums">{fmtTime(itemStart(item))}</span>

  if (m.kind === 'timestamp')
    return (
      <div data-id={m.id} onClick={props.onClick} className="relative my-1 flex cursor-pointer items-center justify-center gap-2">
        {now}
        <span className={`tok-stamp rounded-full text-[11px] ${ring}`}>{m.text}</span>
        {at}
      </div>
    )

  if (m.kind === 'system' && m.system)
    return (
      <div data-id={m.id} onClick={props.onClick} className="relative my-1 flex cursor-pointer flex-col items-center gap-0.5">
        {now}
        <span className={`rounded-xl px-2 py-1 text-center text-[11px] font-medium text-ink/50 ${ring}`}>
          <Users className="mr-1 inline h-3 w-3" />
          {props.describe(m.system)}
        </span>
        {at}
      </div>
    )

  const from = participants.find((p) => p.id === m.from) ?? participants.find((p) => !p.isMe)
  const mine = !!from?.isMe
  const whatsapp = props.app === 'whatsapp'
  const bubble = mine
    ? whatsapp
      ? 'bg-[#D9FDD3] text-ink'
      : props.sms
        ? 'bg-[#34C759] text-white'
        : 'bg-[#0A84FF] text-white'
    : whatsapp
      ? 'bg-white text-ink ring-1 ring-ink/5'
      : 'bg-[#E9E9EB] text-ink'
  const neverSent = isNeverSent(m)
  const c = choreography(m)
  const speed = speedOf(m)
  const chips: ReactNode[] = []
  if (m.wait) chips.push(<Chip key="w">⏳ {t('chipWait', { s: round(m.wait) })}</Chip>)
  if (m.kind === 'typing')
    chips.push(
      <Chip key="st" tone="pink">
        💬 {t('chipStops', { s: round(m.typing ?? 2) })}
      </Chip>,
    )
  else if (m.typing !== undefined) chips.push(<Chip key="t">⌨️ {t(mine ? 'chipTyping' : 'chipTypingTheirs', { s: round(m.typing) })}</Chip>)
  if (m.hold !== undefined) chips.push(<Chip key="h">👀 {t('chipHold', { s: round(m.hold) })}</Chip>)
  if (m.instant) chips.push(<Chip key="i">⚡ {t('chipInstant')}</Chip>)
  if (c.typos)
    chips.push(
      <Chip key="ty" tone="honey">
        ✏️ {t('chipTypos', { n: c.typos })}
      </Chip>,
    )
  if (c.mistakes)
    chips.push(
      <Chip key="mi" tone="honey">
        ↩︎ {t('chipMistakes')}
      </Chip>,
    )
  if (c.pauses)
    chips.push(
      <Chip key="pa" tone="honey">
        ⏸ {t('chipPauses')}
      </Chip>,
    )
  if (speed !== 'normal')
    chips.push(
      <Chip key="sp" tone="honey">
        {speed === 'slow' ? `🐢 ${t('chipSlow')}` : `🐇 ${t('chipFast')}`}
      </Chip>,
    )
  if (neverSent)
    chips.push(
      <Chip key="ns" tone="pink">
        🗑 {t('neverSent')}
      </Chip>,
    )
  const img = m.kind === 'image' ? getImage(m.image) : null

  return (
    <div data-id={m.id} onClick={props.onClick} className={`relative flex cursor-pointer items-end gap-1.5 py-0.5 ${mine ? 'flex-row-reverse' : ''}`}>
      {now}
      {!mine && <Avatar asset={from?.avatar ?? null} name={from?.name ?? '?'} size={24} emoji={from?.emoji} color={from?.color} />}
      <div className={`flex max-w-[78%] min-w-0 flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {!mine && group && <span className="mb-0.5 px-2 text-[10px] font-bold text-ink/45">{from?.name}</span>}
        <div className={`relative rounded-[18px] px-3 py-1.5 text-[14px] leading-snug transition ${bubble} ${ring} ${props.open ? 'shadow-md' : ''}`}>
          {m.kind === 'typing' ? (
            <span className="flex gap-1 py-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="dot-bounce h-2 w-2 rounded-full bg-ink/45" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          ) : m.kind === 'image' ? (
            img ? (
              <img src={img.src} alt="" className="my-0.5 max-h-40 rounded-xl object-cover" />
            ) : (
              <span className="flex items-center gap-1.5 py-2 text-xs opacity-80">
                <ImagePlus className="h-4 w-4" /> {t('uploadPhoto')}
              </span>
            )
          ) : (
            <span className={`break-words whitespace-pre-wrap ${neverSent ? 'line-through opacity-60' : ''}`}>
              {neverSent ? typedBeforeClear(m) : m.text || '…'}
            </span>
          )}
          {(m.reactions?.length ?? 0) > 0 && (
            <span className={`absolute -top-3 flex gap-0.5 ${mine ? '-left-3' : '-right-3'}`}>
              {m.reactions!.map((r, i) => (
                <span
                  key={i}
                  className="grid h-6 min-w-6 place-items-center rounded-full bg-white px-1 text-[11px] font-black text-ink shadow-sm ring-1 ring-ink/10"
                >
                  {r.emoji === 'HAHA' ? 'HA' : r.emoji}
                </span>
              ))}
            </span>
          )}
        </div>
        {(chips.length > 0 || at) && (
          <div className={`mt-1 flex flex-wrap items-center gap-1 ${mine ? 'justify-end' : ''}`}>
            {chips}
            {at}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- the edit panel under a message

function Editor(props: {
  m: Message
  idx: number
  count: number
  participants: Participant[]
  t: T
  onClose: () => void
  rewrite: (idx: number, patch: Partial<Message>, timing?: MessageTiming, coalesce?: string) => void
  edit: (fn: (src: string, msgs: Message[]) => string, focus?: number | null, coalesce?: string) => void
}) {
  const { m, idx, participants, t, rewrite, edit } = props
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [raw, setRaw] = useState(m.raw ?? '')
  const [reactor, setReactor] = useState('')
  const [customEmoji, setCustomEmoji] = useState('')
  const mine = !!participants.find((p) => p.id === m.from)?.isMe
  const timing: MessageTiming = { wait: m.wait, typing: m.typing, hold: m.hold, instant: m.instant }
  const setTiming = (patch: Partial<MessageTiming>, key: string) =>
    rewrite(idx, m.kind === 'typing' && 'typing' in patch ? { typing: patch.typing } : {}, { ...timing, ...patch }, `timing-${idx}-${key}`)

  // Follow changes made elsewhere (script editor, undo) unless the user is typing in this box.
  useEffect(() => {
    if (document.activeElement !== textRef.current) setRaw(m.raw ?? '')
  }, [m.raw])

  const saveRaw = (v: string, coalesce = `raw-${idx}`) => {
    setRaw(v)
    rewrite(idx, { raw: v }, undefined, coalesce)
  }

  const insertAtCursor = (snippet: string, selectInner?: string) => {
    const el = textRef.current
    const start = el?.selectionStart ?? raw.length
    const end = el?.selectionEnd ?? raw.length
    const next = raw.slice(0, start) + snippet + raw.slice(end)
    saveRaw(next, `tag-${idx}-${Date.now()}`)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const i = selectInner ? next.indexOf(selectInner, start) : -1
      if (i >= 0 && selectInner) el.setSelectionRange(i, i + selectInner.length)
      else el.setSelectionRange(start + snippet.length, start + snippet.length)
    })
  }

  const reactions = m.reactions ?? []
  const toggleReaction = (emoji: string) => {
    const on = reactions.some((r) => r.emoji === emoji && r.from === reactor)
    const next: Reaction[] = on ? reactions.filter((r) => !(r.emoji === emoji && r.from === reactor)) : [...reactions, { emoji, from: reactor }]
    saveRaw(withReactions(raw, next, participants), `react-${idx}-${Date.now()}`)
  }

  const footer = (
    <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-ink/[0.06] pt-2.5">
      {(m.kind === 'text' || m.kind === 'image') && (
        <button
          type="button"
          onClick={() => edit((src) => setVideoStart(src, idx), idx)}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold text-[#8A5300] transition hover:bg-butter"
        >
          <Flag className="h-3.5 w-3.5" /> {t('msgStartAfter')}
        </button>
      )}
      <span className="ml-auto flex items-center gap-0.5">
        {[
          { icon: ArrowUp, title: t('moveUp'), disabled: idx === 0, fn: () => edit((src, msgs) => moveMessageBy(src, msgs, idx, -1), idx - 1) },
          { icon: ArrowDown, title: t('moveDown'), disabled: idx >= props.count - 1, fn: () => edit((src, msgs) => moveMessageBy(src, msgs, idx, 1), idx + 1) },
          { icon: Copy, title: t('duplicate'), fn: () => edit((src, msgs) => duplicateMessage(src, msgs[idx]), idx + 1) },
          { icon: Trash2, title: t('delete'), danger: true, fn: () => edit((src, msgs) => removeMessage(src, msgs[idx]), null) },
          { icon: X, title: t('close'), fn: props.onClose },
        ].map(({ icon: Icon, title, fn, disabled, danger }) => (
          <button
            key={title}
            type="button"
            title={title}
            disabled={disabled}
            onClick={fn}
            className={`grid h-8 w-8 place-items-center rounded-full transition disabled:opacity-25 ${danger ? 'text-ink/45 hover:bg-red-50 hover:text-red-600' : 'text-ink/45 hover:bg-ink/[0.06] hover:text-ink'}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </span>
    </div>
  )

  const shell = (children: ReactNode) => (
    <div className="pop-in relative my-2 rounded-3xl bg-cream p-3.5 ring-1 ring-ink/[0.07]" onClick={(e) => e.stopPropagation()}>
      {children}
      {footer}
    </div>
  )

  if (m.kind === 'timestamp')
    return shell(
      <label className="block">
        <Label>{t('timestampText')}</Label>
        <input value={m.text ?? ''} onChange={(e) => rewrite(idx, { text: e.target.value }, undefined, `ts-${idx}`)} className={inputCls} />
        <p className="mt-1.5 text-[11px] text-ink/45">{t('timestampHint')}</p>
      </label>,
    )

  if (m.kind === 'system' && m.system) {
    const e = m.system
    const setE = (patch: Partial<SystemEvent>) => rewrite(idx, { system: { ...e, ...patch } }, undefined, `sys-${idx}`)
    const labels: Record<SystemEvent['type'], string> = {
      added: t('sysAddedL'),
      removed: t('sysRemovedL'),
      left: t('sysLeftL'),
      renamed: t('sysRenamedL'),
      photo: t('sysPhotoL'),
      custom: t('sysCustomL'),
    }
    return shell(
      <div className="space-y-3">
        <div>
          <Label>{t('insSystem')}</Label>
          <div className="flex flex-wrap gap-1">
            {SYSTEM_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setE({ type })}
                className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${e.type === type ? 'bg-ink text-white' : 'bg-ink/[0.05] text-ink/60 hover:text-ink'}`}
              >
                {labels[type]}
              </button>
            ))}
          </div>
        </div>
        {e.type !== 'custom' && (
          <div>
            <Label>{t('sysWho')}</Label>
            <PeoplePills
              people={participants.filter((p) => !p.isMe)}
              value={e.actor ? participantId(e.actor) : ''}
              onChange={(id) => setE({ actor: participants.find((p) => p.id === id)?.name ?? '' })}
              noneLabel={t('me')}
            />
          </div>
        )}
        {(e.type === 'added' || e.type === 'removed') && (
          <label className="block">
            <Label>{t('sysWhom')}</Label>
            <input value={e.target ?? ''} onChange={(ev) => setE({ target: ev.target.value })} className={inputCls} />
          </label>
        )}
        {(e.type === 'renamed' || e.type === 'custom') && (
          <label className="block">
            <Label>{e.type === 'renamed' ? t('sysNewName') : t('sysText')}</Label>
            <input value={e.text ?? ''} onChange={(ev) => setE({ text: ev.target.value })} className={inputCls} />
          </label>
        )}
      </div>,
    )
  }

  if (m.kind === 'typing')
    return shell(
      <div className="space-y-3">
        <div>
          <Label>{t('msgSender')}</Label>
          <PeoplePills people={participants.filter((p) => !p.isMe)} value={m.from ?? ''} onChange={(id) => rewrite(idx, { from: id })} />
        </div>
        <SecondsSlider label={t('duration')} value={m.typing ?? 2} onChange={(v) => setTiming({ typing: v ?? 2 }, 'typing')} min={0.5} max={12} fallback={2} />
        <SecondsSlider label={t('msgWait')} value={m.wait ?? 0} onChange={(v) => setTiming({ wait: v || undefined }, 'wait')} min={0} max={10} fallback={0} />
      </div>,
    )

  // text and photo messages
  return shell(
    <div className="space-y-3.5">
      <div>
        <Label>{t('msgSender')}</Label>
        <PeoplePills people={participants} value={m.from ?? ''} onChange={(id) => rewrite(idx, { from: id })} />
      </div>

      {m.kind === 'image' && (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/15 bg-white px-3 py-2.5 text-xs font-bold text-ink/60 transition hover:border-honey hover:text-ink">
          <ImagePlus className="h-4 w-4" /> {getImage(m.image) ? t('replacePhoto') : t('uploadPhoto')}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const id = await addAsset(f, f.name)
              saveRaw(`<image:${id}>`)
            }}
          />
        </label>
      )}

      {m.kind === 'text' && (
        <div>
          <Label>{t('msgText')}</Label>
          <RawEditor value={raw} onChange={(v) => saveRaw(v)} inputRef={textRef} />
          {mine && (
            <>
              <div className="mt-2 flex flex-wrap gap-1">
                {[
                  { label: `✏️ ${t('msgAddTypo')}`, fn: () => insertAtCursor('<typo>') },
                  { label: `⏸ ${t('msgAddPause')}`, fn: () => insertAtCursor('<pause 1s>', '1s') },
                  { label: `↩︎ ${t('msgAddMistake')}`, fn: () => insertAtCursor(`<mistake ${t('msgMistakeWord')}>`, t('msgMistakeWord')) },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={b.fn}
                    className="rounded-full bg-butter px-2.5 py-1 text-[11px] font-bold text-[#8A5300] transition hover:brightness-95"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10.5px] leading-snug text-ink/40">{t('msgTextHint')}</p>
            </>
          )}
        </div>
      )}

      {mine && m.kind === 'text' && (
        <div className="space-y-2.5 rounded-2xl bg-white p-3 ring-1 ring-ink/[0.06]">
          <Label>{t('msgChoreo')}</Label>
          <div>
            <div className="mb-1 text-xs font-semibold text-ink/60">{t('msgSpeed')}</div>
            <Segmented<TypingSpeed>
              value={speedOf(m)}
              onChange={(v) => saveRaw(setSpeed(raw, v), `speed-${idx}`)}
              options={[
                { value: 'slow', label: `🐢 ${t('slow')}` },
                { value: 'normal', label: t('normalSpeed') },
                { value: 'fast', label: `🐇 ${t('fast')}` },
              ]}
            />
          </div>
          <Toggle checked={isNeverSent(m)} onChange={(v) => saveRaw(setNeverSent(raw, v), `clear-${idx}`)} label={t('msgNeverSend')} />
          <Toggle checked={!!m.instant} onChange={(v) => setTiming({ instant: v || undefined }, 'instant')} label={t('msgInstant')} />
        </div>
      )}

      <div className="space-y-2.5 rounded-2xl bg-white p-3 ring-1 ring-ink/[0.06]">
        <Label>{t('msgTiming')}</Label>
        <SecondsSlider label={t('msgWait')} value={m.wait ?? 0} onChange={(v) => setTiming({ wait: v || undefined }, 'wait')} min={0} max={10} fallback={0} />
        {!(mine && m.instant) && (
          <SecondsSlider
            label={mine ? t('msgTypingMine') : t('msgTypingTheirs')}
            value={m.typing}
            onChange={(v) => setTiming({ typing: v }, 'typing')}
            min={0.3}
            max={15}
            fallback={2}
            autoLabel={t('auto')}
          />
        )}
        <SecondsSlider
          label={t('msgHold')}
          value={m.hold}
          onChange={(v) => setTiming({ hold: v }, 'hold')}
          min={0}
          max={10}
          fallback={2}
          autoLabel={t('auto')}
        />
      </div>

      <div className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-ink/[0.06]">
        <Label>{t('msgReactions')}</Label>
        <div className="flex flex-wrap items-center gap-1">
          {QUICK_REACTIONS.map((e) => {
            const on = reactions.some((r) => r.emoji === e && r.from === reactor)
            return (
              <button
                key={e}
                type="button"
                onClick={() => toggleReaction(e)}
                className={`grid h-9 min-w-9 place-items-center rounded-full px-1.5 text-base transition ${on ? 'bg-honey ring-2 ring-honey' : 'bg-ink/[0.05] hover:bg-butter'}`}
              >
                {e === 'HAHA' ? <span className="text-[10px] font-black">HAHA</span> : e}
              </button>
            )
          })}
          <input
            value={customEmoji}
            onChange={(e) => setCustomEmoji(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customEmoji.trim()) {
                toggleReaction(customEmoji.trim())
                setCustomEmoji('')
              }
            }}
            placeholder={t('msgOtherEmoji')}
            className="h-9 w-28 rounded-full bg-ink/[0.05] px-3 text-sm outline-none placeholder:text-[11px] placeholder:text-ink/35 focus:bg-white focus:ring-2 focus:ring-honey/50"
          />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-ink/60">{t('msgReactWho')}</div>
          <PeoplePills people={participants.filter((p) => p.id !== m.from)} value={reactor} onChange={setReactor} noneLabel={t('otherSide')} />
        </div>
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {reactions.map((r, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-blush py-0.5 pr-1 pl-2 text-xs font-bold text-[#B0245A]">
                {r.emoji === 'HAHA' ? 'HAHA' : r.emoji} {r.from ? (participants.find((p) => p.id === r.from)?.name ?? r.from) : ''}
                <button
                  type="button"
                  title={t('delete')}
                  onClick={() =>
                    saveRaw(
                      withReactions(
                        raw,
                        reactions.filter((_, j) => j !== i),
                        participants,
                      ),
                      `react-${idx}-${Date.now()}`,
                    )
                  }
                  className="rounded-full p-0.5 hover:bg-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>,
  )
}
