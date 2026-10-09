import { useEffect, type ReactNode } from 'react'
import { Dices, X } from 'lucide-react'
import { applyPreset, PRESETS } from '../lib/presets'
import { useStore } from '../lib/store'
import type { KeyboardMode, Project, Timing } from '../lib/types'
import { useT } from '../lib/ui-i18n'
import { useUi } from '../lib/ui-store'
import { useSetting } from './Inspector'
import { Segmented, Slider, Toggle } from './ui'

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-cream p-4 ring-1 ring-ink/[0.06]">
      <h3 className="mb-3 text-sm font-extrabold text-ink">{title}</h3>
      <div className="space-y-3.5">{children}</div>
    </div>
  )
}

export function AdvancedSettings() {
  const t = useT()
  const open = useUi((s) => s.advancedOpen)
  const setOpen = useUi((s) => s.setAdvancedOpen)
  const lang = useUi((s) => s.lang)
  const project = useStore((s) => s.effective)
  const setting = useSetting()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  const T = project.timing
  const setT = <K extends keyof Timing>(key: K, value: Timing[K], scriptKey: string | null = null, scriptValue = String(value)) =>
    setting(scriptKey, scriptValue, (p: Project) => ({ ...p, preset: '', timing: { ...p.timing, [key]: value } }), { coalesce: `adv-${key}`, timing: true })
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const secs = (v: number) => `${v.toFixed(2)} ${t('sec')}`

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-3 font-rounded text-ink backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adv-title"
        className="pop-in flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-ink/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink/[0.06] px-6 py-4">
          <h2 id="adv-title" className="text-lg font-extrabold">
            🎛️ {t('advTitle')}
          </h2>
          <button
            type="button"
            title={t('close')}
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-full text-ink/40 transition hover:bg-ink/[0.06] hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <h3 className="mb-2.5 text-sm font-extrabold text-ink">{t('advPresets')}</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setting('preset', p.id, (pr) => applyPreset(pr, p.id))}
                  className={`squish rounded-2xl p-3 text-left ring-1 transition ${
                    project.preset === p.id ? 'bg-butter ring-2 ring-honey' : 'bg-cream ring-ink/[0.07] hover:ring-ink/20'
                  }`}
                >
                  <div className="text-sm font-bold">
                    {p.emoji} {p.label[lang]}
                  </div>
                  <div className="mt-1 text-[11px] leading-snug text-ink/55">{p.description[lang]}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Group title={t('advMyTyping')}>
              <Segmented<KeyboardMode>
                value={project.keyboard}
                onChange={(v) => setting('keyboard', v, (p) => ({ ...p, keyboard: v, preset: '' }), { timing: true })}
                options={[
                  { value: 'off', label: t('kbOff') },
                  { value: 'typing', label: t('kbTyping') },
                  { value: 'always', label: t('kbAlways') },
                ]}
              />
              <Slider
                label={t('typingSpeed')}
                value={T.keyboardCps}
                min={3}
                max={28}
                step={0.5}
                onChange={(v) => setT('keyboardCps', v, 'typing_speed')}
                format={(v) => `${v} ${t('cps')}`}
              />
              <Slider label={t('rhythm')} value={T.jitter} min={0} max={0.8} onChange={(v) => setT('jitter', v, 'rhythm', v.toFixed(2))} format={pct} />
              <Slider
                label={t('typoRate')}
                value={T.typoRate}
                min={0}
                max={0.12}
                step={0.005}
                onChange={(v) => setT('typoRate', v, 'typos', v.toFixed(3))}
                format={(v) => `${pct(v)} ${t('perLetter')}`}
              />
              <Slider label={t('lateTypo')} value={T.lateTypo} min={0} max={1} onChange={(v) => setT('lateTypo', v, 'late_typos', v.toFixed(2))} format={pct} />
              <Slider
                label={t('hesitation')}
                value={T.hesitation}
                min={0}
                max={1}
                onChange={(v) => setT('hesitation', v, 'hesitation', v.toFixed(2))}
                format={(v) => `${pct(v)} ${t('perMessage')}`}
              />
              <div className="grid grid-cols-2 gap-3">
                <Slider
                  label={`${t('hesitationLen')} ↓`}
                  value={T.hesitationMin}
                  min={0.2}
                  max={4}
                  step={0.1}
                  onChange={(v) =>
                    setT(
                      'hesitationMin',
                      Math.min(v, T.hesitationMax),
                      'pause_length',
                      `${Math.min(v, T.hesitationMax).toFixed(1)}-${T.hesitationMax.toFixed(1)}`,
                    )
                  }
                  format={secs}
                />
                <Slider
                  label="↑"
                  value={T.hesitationMax}
                  min={0.2}
                  max={5}
                  step={0.1}
                  onChange={(v) =>
                    setT(
                      'hesitationMax',
                      Math.max(v, T.hesitationMin),
                      'pause_length',
                      `${T.hesitationMin.toFixed(1)}-${Math.max(v, T.hesitationMin).toFixed(1)}`,
                    )
                  }
                  format={secs}
                />
              </div>
              <Slider
                label={t('keyboardOpen')}
                value={T.keyboardOpen}
                min={0.2}
                max={1.5}
                step={0.05}
                onChange={(v) => setT('keyboardOpen', v, 'keyboard_open', v.toFixed(2))}
                format={secs}
              />
              <Slider
                label={t('keyboardLinger')}
                value={T.keyboardLinger}
                min={0}
                max={3}
                step={0.1}
                onChange={(v) => setT('keyboardLinger', v, 'keyboard_linger', v.toFixed(1))}
                format={secs}
              />
            </Group>

            <div className="space-y-4">
              <Group title={t('advTheirTyping')}>
                <Toggle
                  checked={T.typingIndicator}
                  onChange={(v) => setT('typingIndicator', v, 'typing_indicator', v ? 'on' : 'off')}
                  label={t('typingBubble')}
                />
                <Slider
                  label={t('theirSpeed')}
                  value={T.typingCps}
                  min={3}
                  max={30}
                  step={0.5}
                  onChange={(v) => setT('typingCps', v, 'their_typing_speed')}
                  format={(v) => `${v} ${t('cps')}`}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Slider
                    label={t('minTyping')}
                    value={T.minTyping}
                    min={0.3}
                    max={3}
                    step={0.1}
                    onChange={(v) => setT('minTyping', Math.min(v, T.maxTyping), 'typing_min', Math.min(v, T.maxTyping).toFixed(1))}
                    format={secs}
                  />
                  <Slider
                    label={t('maxTyping')}
                    value={T.maxTyping}
                    min={0.5}
                    max={8}
                    step={0.1}
                    onChange={(v) => setT('maxTyping', Math.max(v, T.minTyping), 'typing_max', Math.max(v, T.minTyping).toFixed(1))}
                    format={secs}
                  />
                </div>
                <Slider
                  label={t('typingStops')}
                  value={T.typingStops}
                  min={0}
                  max={1}
                  onChange={(v) => setT('typingStops', v, 'typing_stops', v.toFixed(2))}
                  format={(v) => `${pct(v)} ${t('perMessage')}`}
                />
              </Group>

              <Group title={t('advPacing')}>
                <Slider
                  label={t('speed')}
                  value={T.speed}
                  min={0.5}
                  max={2.5}
                  onChange={(v) => setT('speed', v, 'speed', v.toFixed(2))}
                  format={(v) => `${v.toFixed(2)}×`}
                />
                <Slider
                  label={t('readBase')}
                  value={T.readBase}
                  min={0}
                  max={3}
                  step={0.05}
                  onChange={(v) => setT('readBase', v, 'read_base', v.toFixed(2))}
                  format={secs}
                />
                <Slider
                  label={t('readPerChar')}
                  value={T.readPerChar}
                  min={0.005}
                  max={0.1}
                  step={0.005}
                  onChange={(v) => setT('readPerChar', v, 'read_per_char', v.toFixed(3))}
                  format={(v) => `${Math.round(v * 1000)} ${t('msPerChar')}`}
                />
                <Slider
                  label={t('readMax')}
                  value={T.readMax}
                  min={1}
                  max={8}
                  step={0.1}
                  onChange={(v) => setT('readMax', v, 'read_max', v.toFixed(1))}
                  format={secs}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Slider
                    label={t('startDelay')}
                    value={T.startDelay}
                    min={0}
                    max={3}
                    step={0.1}
                    onChange={(v) => setT('startDelay', v, 'start_delay', v.toFixed(1))}
                    format={secs}
                  />
                  <Slider
                    label={t('endHold')}
                    value={T.endHold}
                    min={0}
                    max={6}
                    step={0.1}
                    onChange={(v) => setT('endHold', v, 'end_hold', v.toFixed(1))}
                    format={secs}
                  />
                </div>
              </Group>

              <Group title={t('advRandom')}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink/70">{t('seed')}</span>
                  <span className="rounded-lg bg-white px-2 py-1 font-mono text-xs text-ink ring-1 ring-ink/10">{T.seed}</span>
                  <button
                    type="button"
                    onClick={() => setT('seed', Math.floor(Math.random() * 100000), 'seed')}
                    className="ml-auto flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold ring-1 ring-ink/10 transition hover:ring-ink/25"
                  >
                    <Dices className="h-3.5 w-3.5" /> {t('shuffle')}
                  </button>
                </div>
                <p className="text-[11px] leading-snug text-ink/45">{t('seedHint')}</p>
              </Group>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink/[0.06] px-6 py-3.5">
          {project.preset && (
            <button
              type="button"
              onClick={() => setting('preset', project.preset, (pr) => applyPreset(pr, project.preset))}
              className="rounded-full px-3 py-2 text-xs font-bold text-ink/50 hover:text-ink"
            >
              {t('resetPreset')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="squish rounded-full bg-honey px-5 py-2.5 text-sm font-extrabold shadow-[0_8px_20px_-10px_rgba(255,170,0,0.9)]"
          >
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  )
}
