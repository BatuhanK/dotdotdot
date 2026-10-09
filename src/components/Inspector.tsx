import { Film, ImagePlus, Music, SlidersHorizontal, X } from 'lucide-react'
import { addAsset, getAssetName } from '../lib/assets'
import { LOCALE_LABELS } from '../lib/i18n'
import { applyPreset, PRESETS } from '../lib/presets'
import { setScriptSetting } from '../lib/script'
import { useStore } from '../lib/store'
import type { BackgroundKind, ChatLocale, DeviceId, KeyboardMode, LayoutKind, Project, ReceiptMode } from '../lib/types'
import { useT } from '../lib/ui-i18n'
import { useUi } from '../lib/ui-store'
import { DEVICE_LIST } from '../render/devices'
import { ColorInput, Field, FileButton, NumberInput, Row, Section, Segmented, Select, Slider, TextInput, Toggle } from './ui'

const PRESET_BGS: { c1: string; c2: string }[] = [
  { c1: '#1F2A44', c2: '#7A3E9D' },
  { c1: '#0F172A', c2: '#0EA5E9' },
  { c1: '#FF6A88', c2: '#FF99AC' },
  { c1: '#111111', c2: '#3A3A3A' },
  { c1: '#F7971E', c2: '#FFD200' },
  { c1: '#00C9A7', c2: '#845EC2' },
]

/**
 * Update a setting. If the script controls it with an @setting line, rewrite that line instead.
 * Timing changes while the script uses @preset bake the preset into the editor settings first
 * (and drop the @preset line) so the change isn't overwritten by the preset.
 */
export function useSetting() {
  const update = useStore((s) => s.update)
  const applied = useStore((s) => s.applied)
  return (scriptKey: string | null, scriptValue: string, fn: (p: Project) => Project, opts: { coalesce?: string; timing?: boolean } = {}) => {
    if (scriptKey && applied.includes(scriptKey)) {
      update((p) => ({ ...p, script: setScriptSetting(p.script, scriptKey, scriptValue) }), opts.coalesce)
    } else if (opts.timing && applied.includes('preset')) {
      update((p) => {
        const eff = useStore.getState().effective
        return fn({ ...p, timing: { ...eff.timing }, keyboard: eff.keyboard, preset: '', script: setScriptSetting(p.script, 'preset', null) })
      }, opts.coalesce)
    } else {
      update(fn, opts.coalesce)
    }
  }
}

function Overridden({ k }: { k: string }) {
  const t = useT()
  const applied = useStore((s) => s.applied)
  if (!applied.includes(k)) return null
  return <p className="mt-1 text-[10px] font-semibold text-[#B26B00]">{t('overridden', { key: k })}</p>
}

export function Inspector() {
  const t = useT()
  const project = useStore((s) => s.effective)
  const update = useStore((s) => s.update)
  const setAdvancedOpen = useUi((s) => s.setAdvancedOpen)
  const setting = useSetting()
  const setNested = <K extends 'status' | 'chat' | 'timing' | 'sound' | 'background'>(key: K, patch: Partial<Project[K]>, coalesce?: string) =>
    update((p) => ({ ...p, [key]: { ...p[key], ...patch } }), coalesce)

  const bg = project.background
  const showBg = project.layout !== 'fullscreen'
  const kbHint = project.keyboard === 'off' ? t('kbOffHint') : project.keyboard === 'typing' ? t('kbTypingHint') : t('kbAlwaysHint')

  return (
    <div className="pb-10">
      <Section title={t('sTyping')} emoji="⌨️">
        <Field label={t('preset')}>
          <Select<string>
            value={project.preset || ''}
            onChange={(v) => v && setting('preset', v, (p) => applyPreset(p, v))}
            options={[
              ...(project.preset ? [] : [{ value: '', label: t('custom') }]),
              ...PRESETS.map((p) => ({ value: p.id, label: `${p.emoji}  ${p.label[useUi.getState().lang]}` })),
            ]}
          />
          <Overridden k="preset" />
        </Field>
        <Field label={t('myMessages')}>
          <Segmented<KeyboardMode>
            value={project.keyboard}
            onChange={(v) => setting('keyboard', v, (p) => ({ ...p, keyboard: v, preset: '' }), { timing: true })}
            options={[
              { value: 'off', label: t('kbOff') },
              { value: 'typing', label: t('kbTyping') },
              { value: 'always', label: t('kbAlways') },
            ]}
          />
          <p className="mt-1.5 text-[11px] leading-snug text-ink/45">{kbHint}</p>
          <Overridden k="keyboard" />
        </Field>
        <Slider
          label={t('speed')}
          value={project.timing.speed}
          min={0.5}
          max={2.5}
          onChange={(v) =>
            setting('speed', v.toFixed(2), (p) => ({ ...p, preset: '', timing: { ...p.timing, speed: v } }), { coalesce: 'speed', timing: true })
          }
          format={(v) => `${v.toFixed(2)}×`}
        />
        {project.keyboard !== 'off' && (
          <Slider
            label={t('typos')}
            value={project.timing.typoRate}
            min={0}
            max={0.12}
            step={0.005}
            onChange={(v) =>
              setting('typos', v.toFixed(3), (p) => ({ ...p, preset: '', timing: { ...p.timing, typoRate: v } }), { coalesce: 'typos', timing: true })
            }
            format={(v) => `${Math.round(v * 100)}% ${t('perLetter')}`}
          />
        )}
        <Toggle
          checked={project.timing.typingIndicator}
          onChange={(v) => setting('typing_indicator', v ? 'on' : 'off', (p) => ({ ...p, timing: { ...p.timing, typingIndicator: v } }), { timing: true })}
          label={t('typingBubble')}
        />
        <button
          type="button"
          onClick={() => setAdvancedOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-ink/[0.05] px-3 py-2.5 text-xs font-bold text-ink/70 transition hover:bg-butter hover:text-ink"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> {t('advancedSettings')}
        </button>
      </Section>

      <Section title={t('sStyle')} emoji="🎨">
        <Field label={t('app')}>
          <Segmented
            value={project.app}
            onChange={(v) => setting('app', v, (p) => ({ ...p, app: v }))}
            options={[
              { value: 'imessage', label: 'iMessage' },
              { value: 'whatsapp', label: 'WhatsApp' },
            ]}
          />
          <Overridden k="app" />
        </Field>
        <Row>
          <Field label={t('appearance')}>
            <Segmented
              value={project.appearance}
              onChange={(v) => setting('theme', v, (p) => ({ ...p, appearance: v }))}
              options={[
                { value: 'light', label: t('light') },
                { value: 'dark', label: t('dark') },
              ]}
            />
            <Overridden k="theme" />
          </Field>
          <Field label={t('bubbles')}>
            <Segmented
              value={project.chat.service}
              onChange={(v) => setting('bubbles', v === 'sms' ? 'green' : 'blue', (p) => ({ ...p, chat: { ...p.chat, service: v } }))}
              options={[
                { value: 'imessage', label: t('blue') },
                { value: 'sms', label: t('green') },
              ]}
            />
            <Overridden k="bubbles" />
          </Field>
        </Row>
        <Row>
          <Field label={t('phoneLanguage')}>
            <Select<ChatLocale>
              value={project.locale}
              onChange={(v) => setting('language', v, (p) => ({ ...p, locale: v }))}
              options={(Object.keys(LOCALE_LABELS) as ChatLocale[]).map((k) => ({ value: k, label: LOCALE_LABELS[k] }))}
            />
            <Overridden k="language" />
          </Field>
          <Field label={t('clock')}>
            <Segmented
              value={project.clock24 ? '24' : '12'}
              onChange={(v) => setting('clock', `${v}h`, (p) => ({ ...p, clock24: v === '24' }))}
              options={[
                { value: '12', label: '12h' },
                { value: '24', label: '24h' },
              ]}
            />
            <Overridden k="clock" />
          </Field>
        </Row>
        <Row>
          <Field label={t('messageTime')} hint="HH:MM">
            <TextInput
              value={project.chat.clock}
              onChange={(v) => setting('time', v, (p) => ({ ...p, chat: { ...p.chat, clock: v } }), { coalesce: 'clock' })}
            />
            <Overridden k="time" />
          </Field>
          <Field label={t('readReceipts')}>
            <Select<ReceiptMode>
              value={project.receipts}
              onChange={(v) => setting('receipts', v, (p) => ({ ...p, receipts: v }))}
              options={[
                { value: 'read', label: t('read') },
                { value: 'delivered', label: t('delivered') },
                { value: 'none', label: t('hidden') },
              ]}
            />
            <Overridden k="receipts" />
          </Field>
        </Row>
        <div>
          <Toggle
            checked={project.chat.localizeStamps}
            onChange={(v) => setting('timestamps', v ? 'auto' : 'literal', (p) => ({ ...p, chat: { ...p.chat, localizeStamps: v } }))}
            label={t('translateStamps')}
          />
          <p className="mt-1 text-[11px] leading-snug text-ink/45">{t('translateStampsHint')}</p>
          <Overridden k="timestamps" />
        </div>
      </Section>

      <Section title={t('sPhone')} emoji="📱">
        <Field label={t('model')}>
          <Select<DeviceId>
            value={project.device}
            onChange={(v) => setting('device', v, (p) => ({ ...p, device: v }))}
            options={DEVICE_LIST.map((d) => ({ value: d.id, label: d.name }))}
          />
          <Overridden k="device" />
        </Field>
        <Field label={t('layout')}>
          <Segmented<LayoutKind>
            value={project.layout}
            onChange={(v) => setting('layout', v, (p) => ({ ...p, layout: v }))}
            options={[
              { value: 'fullscreen', label: t('fullScreen') },
              { value: 'mockup', label: t('phoneMockup') },
              { value: 'split', label: t('split') },
            ]}
          />
          <Overridden k="layout" />
        </Field>
        {project.layout === 'split' && (
          <Slider
            label={t('chatHeight')}
            value={project.splitRatio}
            min={0.4}
            max={0.75}
            onChange={(v) => update((p) => ({ ...p, splitRatio: v }))}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        )}
        <Row>
          <Field label={t('statusTime')}>
            <TextInput
              value={project.status.time}
              onChange={(v) => setting('status_time', v, (p) => ({ ...p, status: { ...p.status, time: v } }), { coalesce: 'stime' })}
            />
            <Overridden k="status_time" />
          </Field>
          <Field label={t('battery')}>
            <NumberInput
              value={project.status.battery}
              min={1}
              max={100}
              onChange={(v) => {
                const n = Math.max(1, Math.min(100, v))
                setting('battery', String(n), (p) => ({ ...p, status: { ...p.status, battery: n } }))
              }}
            />
            <Overridden k="battery" />
          </Field>
        </Row>
        <Row>
          <Field label={t('signal')}>
            <Segmented
              value={project.status.signal}
              onChange={(v) => setting('signal', String(v), (p) => ({ ...p, status: { ...p.status, signal: v } }))}
              options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
            />
          </Field>
          <div className="space-y-1.5 pt-5">
            <Toggle
              checked={project.status.wifi}
              onChange={(v) => setting('wifi', v ? 'on' : 'off', (p) => ({ ...p, status: { ...p.status, wifi: v } }))}
              label={t('wifi')}
            />
            <Toggle
              checked={project.status.charging}
              onChange={(v) => setting('charging', v ? 'on' : 'off', (p) => ({ ...p, status: { ...p.status, charging: v } }))}
              label={t('charging')}
            />
          </div>
        </Row>
        {project.layout !== 'mockup' && (
          <Toggle checked={project.status.showIsland} onChange={(v) => setNested('status', { showIsland: v })} label={t('showIsland')} />
        )}
      </Section>

      {showBg && (
        <Section title={t('sBackground')} emoji="🖼️">
          <Segmented<BackgroundKind>
            value={bg.kind}
            onChange={(v) => setNested('background', { kind: v })}
            options={[
              { value: 'color', label: t('color') },
              { value: 'gradient', label: t('gradient') },
              { value: 'image', label: t('image') },
              { value: 'video', label: t('video') },
            ]}
          />
          {(bg.kind === 'color' || bg.kind === 'gradient') && (
            <>
              <Row>
                <ColorInput value={bg.color} onChange={(v) => setNested('background', { color: v }, 'bgc')} />
                {bg.kind === 'gradient' && <ColorInput value={bg.color2} onChange={(v) => setNested('background', { color2: v }, 'bgc2')} />}
              </Row>
              <div className="flex gap-1.5">
                {PRESET_BGS.map((p) => (
                  <button
                    key={p.c1 + p.c2}
                    type="button"
                    onClick={() => setNested('background', { kind: 'gradient', color: p.c1, color2: p.c2 })}
                    className="h-8 flex-1 rounded-xl ring-1 ring-ink/10 transition hover:scale-105 hover:ring-ink/30"
                    style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }}
                  />
                ))}
              </div>
            </>
          )}
          {(bg.kind === 'image' || bg.kind === 'video') && (
            <>
              <FileButton
                accept={bg.kind === 'image' ? 'image/*' : 'video/*'}
                onFile={async (f) => setNested('background', { asset: await addAsset(f, f.name) })}
              >
                {bg.kind === 'image' ? <ImagePlus className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                {bg.asset ? getAssetName(bg.asset) || t('replace') : bg.kind === 'image' ? t('uploadImage') : t('uploadVideo')}
              </FileButton>
              <Slider
                label={t('darken')}
                value={bg.dim}
                min={0}
                max={0.8}
                onChange={(v) => setNested('background', { dim: v }, 'dim')}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              {bg.kind === 'video' && (
                <Toggle checked={project.sound.videoAudio} onChange={(v) => setNested('sound', { videoAudio: v })} label={t('keepVideoSound')} />
              )}
            </>
          )}
        </Section>
      )}

      <Section title={t('sSound')} emoji="🔊">
        <Toggle checked={project.sound.enabled} onChange={(v) => setNested('sound', { enabled: v })} label={t('messageSounds')} />
        {project.keyboard !== 'off' && (
          <Toggle checked={project.sound.keyboardClicks} onChange={(v) => setNested('sound', { keyboardClicks: v })} label={t('keyboardClicks')} />
        )}
        <Slider
          label={t('volume')}
          value={project.sound.volume}
          min={0}
          max={1}
          onChange={(v) => setNested('sound', { volume: v }, 'vol')}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <div className="flex items-center gap-2">
          <FileButton accept="audio/*" onFile={async (f) => setNested('sound', { music: await addAsset(f, f.name) })}>
            <Music className="h-4 w-4" /> {project.sound.music ? getAssetName(project.sound.music) || t('replace') : t('addMusic')}
          </FileButton>
          {project.sound.music && (
            <button type="button" title={t('removeMusic')} onClick={() => setNested('sound', { music: null })} className="text-ink/40 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {project.sound.music && (
          <Slider
            label={t('musicVolume')}
            value={project.sound.musicVolume}
            min={0}
            max={1}
            onChange={(v) => setNested('sound', { musicVolume: v }, 'mvol')}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        )}
      </Section>
    </div>
  )
}
