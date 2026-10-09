import { ImagePlus, X } from 'lucide-react'
import { addAsset, getImage } from '../lib/assets'
import { participantId } from '../lib/script'
import { useStore } from '../lib/store'
import { useT } from '../lib/ui-i18n'
import { initials } from '../render/scene'
import { FileButton, TextInput, Toggle } from './ui'

function Avatar({ asset, name, size = 32, emoji, color }: { asset: string | null; name: string; size?: number; emoji?: string; color?: string }) {
  const img = getImage(asset)
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-b from-neutral-400 to-neutral-600 text-[11px] font-semibold text-white"
      style={{ width: size, height: size, ...(emoji && !img ? { background: color ?? '#E6DAFF', fontSize: size * 0.55 } : {}) }}
    >
      {img ? <img src={img.src} alt="" className="h-full w-full object-cover" /> : emoji || initials(name)}
    </span>
  )
}

function renameInScript(script: string, from: string, to: string): string {
  const id = participantId(from)
  return script
    .split('\n')
    .map((line) => {
      const m = /^(\s*)([^:[\]{}#\n]{1,40}?)(\s*:)/.exec(line)
      if (m && participantId(m[2]) === id) return `${m[1]}${to}${m[3]}${line.slice(m[0].length)}`
      return line.replace(/\{([^{}\s]+)\s+([^{}]+)\}/g, (all, emoji: string, who: string) => (participantId(who) === id ? `{${emoji} ${to}}` : all))
    })
    .join('\n')
}

export function People() {
  const t = useT()
  const participants = useStore((s) => s.participants)
  const project = useStore((s) => s.project)
  const effective = useStore((s) => s.effective)
  const setParticipant = useStore((s) => s.setParticipant)
  const setMe = useStore((s) => s.setMe)
  const update = useStore((s) => s.update)

  if (!participants.length) return <p className="text-xs text-ink/45">{t('noPeople')}</p>

  return (
    <div className="space-y-2">
      {participants.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          <FileButton
            accept="image/*"
            onFile={async (f) => setParticipant(p.id, { avatar: await addAsset(f, f.name) })}
            className="group relative shrink-0 rounded-full"
          >
            <Avatar asset={p.avatar} name={p.name} emoji={p.emoji} color={p.color} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/60 opacity-0 transition group-hover:opacity-100">
              <ImagePlus className="h-3.5 w-3.5 text-white" />
            </span>
          </FileButton>
          <input
            key={p.name}
            defaultValue={p.name}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (!v || v === p.name) return
              const was = project.participants.find((x) => x.id === p.id) ?? p
              update((pr) => ({
                ...pr,
                script: renameInScript(pr.script, p.name, v),
                participants: [...pr.participants.filter((x) => x.id !== p.id && x.id !== participantId(v)), { ...was, id: participantId(v), name: v }],
              }))
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold text-ink outline-none transition hover:border-ink/10 focus:border-honey focus:bg-white"
          />
          {!p.avatar && (
            <input
              value={p.emoji ?? ''}
              onChange={(e) => setParticipant(p.id, { emoji: e.target.value.trim() || undefined })}
              placeholder="😀"
              title={t('emojiAvatar')}
              className="w-10 shrink-0 rounded-xl border border-ink/10 bg-cream py-1.5 text-center text-sm outline-none placeholder:opacity-40 focus:border-honey focus:bg-white"
            />
          )}
          {p.avatar && (
            <button type="button" title={t('removePhoto')} onClick={() => setParticipant(p.id, { avatar: null })} className="text-ink/40 hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMe(p.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
              p.isMe ? 'bg-[#0A84FF] text-white' : 'bg-ink/[0.06] text-ink/50 hover:bg-ink/10 hover:text-ink'
            }`}
            title={t('meTooltip')}
          >
            {p.isMe ? t('me') : t('setAsMe')}
          </button>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_auto] gap-2 pt-1">
        <TextInput
          value={project.chat.title}
          onChange={(v) => update((pr) => ({ ...pr, chat: { ...pr.chat, title: v } }), 'title')}
          placeholder={
            participants.filter((x) => !x.isMe).length > 1 || effective.chat.group
              ? t('groupName', {
                  name: participants
                    .filter((x) => !x.isMe)
                    .map((x) => x.name.split(' ')[0])
                    .join(', '),
                })
              : t('headerName', { name: participants.find((x) => !x.isMe)?.name ?? '—' })
          }
        />
        <FileButton
          accept="image/*"
          onFile={async (f) => {
            const id = await addAsset(f, f.name)
            update((pr) => ({ ...pr, chat: { ...pr.chat, avatar: id } }))
          }}
          className="flex items-center gap-1.5 rounded-xl border border-ink/10 bg-cream px-3 text-xs font-semibold text-ink/65 transition hover:border-honey hover:text-ink"
        >
          <ImagePlus className="h-3.5 w-3.5" /> {t('headerPhoto')}
        </FileButton>
      </div>
      <div>
        <Toggle
          checked={participants.filter((x) => !x.isMe).length > 1 || effective.chat.group}
          onChange={(v) => update((pr) => ({ ...pr, chat: { ...pr.chat, group: v } }))}
          label={t('groupChat')}
        />
        <p className="mt-1 text-[11px] leading-snug text-ink/45">{t('groupChatHint')}</p>
      </div>
      {project.chat.avatar && (
        <button
          type="button"
          onClick={() => update((pr) => ({ ...pr, chat: { ...pr.chat, avatar: null } }))}
          className="text-[11px] font-semibold text-ink/45 hover:text-ink"
        >
          {t('removeHeaderPhoto')}
        </button>
      )}
    </div>
  )
}

export { Avatar }
