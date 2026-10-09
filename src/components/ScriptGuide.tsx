import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Bot, Check, ClipboardPaste, Copy, Settings2, Sparkles, Tags, X } from 'lucide-react'
import { SAMPLES } from '../lib/defaults'
import { BASICS, buildAgentPrompt, EXAMPLE_SCRIPT, SETTING_DOCS, TAG_GROUPS } from '../lib/script-docs'
import { highlightScript } from '../lib/script-language'
import { useStore } from '../lib/store'
import { useT } from '../lib/ui-i18n'
import { useUi } from '../lib/ui-store'
import { inputCls, Segmented, Slider } from './ui'

type Tab = 'basics' | 'tags' | 'settings' | 'examples' | 'ai'

const COPY = {
  en: {
    title: 'Script guide',
    basics: 'Basics',
    tags: 'Tags',
    settings: 'Settings',
    examples: 'Examples',
    ai: 'AI prompt',
    intro:
      'A script is plain text: one message per line, plus optional tags that choreograph typing, timing and reactions. Tags work in any language and are forgiving (aliases, extra spaces). Unknown <tags> are shown as normal text, so "I <3 you" is safe.',
    where: { line: 'own line', inline: 'inside a message', both: 'own line or message start' },
    aliases: 'also',
    settingsIntro: 'Settings start with @ and override the editor while they are in the script. Put them at the top.',
    aiIntro:
      'Generate a prompt for ChatGPT, Claude or Gemini. It contains the full script language and storytelling tips — paste it in, then paste the reply back into the Script tab.',
    idea: 'Story idea',
    ideaPh: 'e.g. my roommate thinks I stole her yogurt but it was her boyfriend',
    language: 'Message language',
    length: 'Length',
    messagesUnit: 'messages',
    tone: 'Tone',
    names: 'Names (optional)',
    namesPh: 'e.g. Me, Jessica (roommate)',
    copyPrompt: 'Copy prompt',
    pasteScript: 'Paste reply into editor',
    howTo: '1. Copy the prompt  2. Paste it into your AI  3. Copy its script  4. “Paste reply into editor”',
  },
  tr: {
    title: 'Script rehberi',
    basics: 'Temeller',
    tags: 'Etiketler',
    settings: 'Ayarlar',
    examples: 'Örnekler',
    ai: 'AI prompt',
    intro:
      'Script düz metindir: her satırda bir mesaj, artı yazmayı, zamanlamayı ve tepkileri yöneten isteğe bağlı etiketler. Etiketler her dilde çalışır ve esnektir (takma adlar, fazladan boşluk). Tanınmayan <etiketler> normal metin olarak görünür, yani "seni <3 seviyorum" güvenlidir.',
    where: { line: 'kendi satırında', inline: 'mesajın içinde', both: 'kendi satırında ya da mesaj başında' },
    aliases: 'diğer adları',
    settingsIntro: 'Ayarlar @ ile başlar ve script’te durdukları sürece editördeki ayarları geçersiz kılar. En üste yaz.',
    aiIntro:
      'ChatGPT, Claude veya Gemini için prompt oluştur. İçinde tüm script dili ve hikaye ipuçları var — AI’a yapıştır, cevabını Script sekmesine geri yapıştır.',
    idea: 'Hikaye fikri',
    ideaPh: 'ör. ev arkadaşım yoğurdunu benim yediğimi sanıyor ama sevgilisi yemiş',
    language: 'Mesajların dili',
    length: 'Uzunluk',
    messagesUnit: 'mesaj',
    tone: 'Ton',
    names: 'İsimler (isteğe bağlı)',
    namesPh: 'ör. Ben, Ayşe (ev arkadaşı)',
    copyPrompt: 'Promptu kopyala',
    pasteScript: 'Cevabı editöre yapıştır',
    howTo: '1. Promptu kopyala  2. AI’a yapıştır  3. Verdiği script’i kopyala  4. “Cevabı editöre yapıştır”',
  },
}

const TONES: { id: string; en: string; tr: string }[] = [
  { id: 'funny, absurd, punchline ending', en: '😂 Funny', tr: '😂 Komik' },
  { id: 'dramatic, suspenseful, with a plot twist', en: '🎭 Drama / twist', tr: '🎭 Dram / ters köşe' },
  { id: 'romantic, sweet, butterflies', en: '💘 Romantic', tr: '💘 Romantik' },
  { id: 'creepy, unsettling horror that escalates', en: '👻 Creepy', tr: '👻 Ürkütücü' },
  { id: 'cringe, awkward, second-hand embarrassment', en: '😬 Cringe', tr: '😬 Utanç' },
  { id: 'wholesome, heartwarming, happy ending', en: '🥹 Wholesome', tr: '🥹 Duygusal' },
]

const LANGS = ['English', 'Turkish', 'Spanish', 'German', 'French', 'Portuguese']

function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useT()
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
      className="squish flex items-center gap-1.5 rounded-full bg-honey px-4 py-2.5 text-xs font-extrabold shadow-[0_8px_20px_-10px_rgba(255,170,0,0.9)]"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? t('copied') : label}
    </button>
  )
}

/** A script sample, colored like the editor. */
function Code({ children }: { children: string }) {
  const parts = useMemo(() => highlightScript(children), [children])
  return (
    <pre className="overflow-x-auto rounded-2xl bg-white px-4 py-3 font-mono text-[12px] leading-[1.8] whitespace-pre-wrap text-ink ring-1 ring-ink/[0.08]">
      {parts.map((p, i) =>
        p.cls ? (
          <span key={i} className={p.cls}>
            {p.text}
          </span>
        ) : (
          p.text
        ),
      )}
    </pre>
  )
}

export function ScriptGuide() {
  const t = useT()
  const open = useUi((s) => s.guideOpen)
  const setOpen = useUi((s) => s.setGuideOpen)
  const lang = useUi((s) => s.lang)
  const loadScript = useStore((s) => s.loadScript)
  const c = COPY[lang]
  const [tab, setTab] = useState<Tab>('ai')
  const [idea, setIdea] = useState('')
  const [language, setLanguage] = useState(lang === 'tr' ? 'Turkish' : 'English')
  const [messages, setMessages] = useState(18)
  const [tone, setTone] = useState(TONES[0].id)
  const [names, setNames] = useState('')
  const prompt = useMemo(() => buildAgentPrompt({ idea, language, messages, tone, names }), [idea, language, messages, tone, names])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const load = (script: string) => {
    loadScript(script)
    setOpen(false)
  }

  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: 'ai', label: c.ai, icon: Bot },
    { id: 'basics', label: c.basics, icon: BookOpen },
    { id: 'tags', label: c.tags, icon: Tags },
    { id: 'settings', label: c.settings, icon: Settings2 },
    { id: 'examples', label: c.examples, icon: Sparkles },
  ]

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-3 font-rounded text-ink backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        className="pop-in flex h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-ink/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-ink/[0.06] px-6 py-3.5">
          <h2 id="guide-title" className="shrink-0 text-lg font-extrabold">
            📖 {c.title}
          </h2>
          <div className="ml-2 flex gap-1 overflow-x-auto">
            {tabs.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setTab(x.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${tab === x.id ? 'bg-ink text-white' : 'text-ink/50 hover:bg-ink/[0.05] hover:text-ink'}`}
              >
                <x.icon className="h-3.5 w-3.5" /> {x.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            title={t('close')}
            onClick={() => setOpen(false)}
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/40 transition hover:bg-ink/[0.06] hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 text-sm">
          {tab === 'basics' && (
            <div className="space-y-4">
              <p className="leading-relaxed text-ink/70">{c.intro}</p>
              <div className="space-y-2.5">
                {BASICS.map((b) => (
                  <div key={b.syntax} className="grid gap-2 md:grid-cols-[minmax(0,300px)_1fr] md:items-center">
                    <Code>{b.syntax}</Code>
                    <p className="text-[13px] text-ink/60">{b.desc[lang]}</p>
                  </div>
                ))}
              </div>
              <Code>{lang === 'tr' ? SAMPLES[1].script.tr : EXAMPLE_SCRIPT}</Code>
            </div>
          )}

          {tab === 'tags' && (
            <div className="space-y-6">
              {TAG_GROUPS.map((g) => (
                <section key={g.title.en}>
                  <h3 className="text-base font-extrabold text-ink">{g.title[lang]}</h3>
                  {g.intro && <p className="mt-1 text-[13px] leading-relaxed text-ink/60">{g.intro[lang]}</p>}
                  <div className="mt-3 space-y-3">
                    {g.tags.map((tag) => (
                      <div key={tag.syntax} className="rounded-3xl bg-cream p-4 ring-1 ring-ink/[0.06]">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="tok-tag font-mono text-[13px] font-semibold">{tag.syntax}</code>
                          <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold text-ink/55">{c.where[tag.where]}</span>
                          {tag.aliases && (
                            <span className="text-[11px] text-ink/45">
                              {c.aliases}: {tag.aliases.join(', ')}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[13px] text-ink/70">{tag.desc[lang]}</p>
                        <div className="mt-2">
                          <Code>{tag.example}</Code>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-3">
              <p className="text-[13px] leading-relaxed text-ink/60">{c.settingsIntro}</p>
              <div className="overflow-hidden rounded-3xl ring-1 ring-ink/[0.07]">
                {SETTING_DOCS.map((s, i) => (
                  <div key={s.key} className={`grid gap-1 px-4 py-2.5 md:grid-cols-[150px_1fr] ${i % 2 ? 'bg-cream' : ''}`}>
                    <code className="tok-setting font-mono text-[13px]">{s.key}</code>
                    <div>
                      <div className="font-mono text-[11px] text-ink/45">{s.values}</div>
                      <div className="text-[13px] text-ink/70">{s.desc[lang]}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'examples' && (
            <div className="space-y-4">
              {SAMPLES.map((s) => (
                <div key={s.id} className="rounded-3xl bg-cream p-4 ring-1 ring-ink/[0.06]">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="font-extrabold">{s.label[lang]}</span>
                    <button type="button" onClick={() => load(s.script[lang])} className="squish rounded-full bg-honey px-3.5 py-1.5 text-xs font-bold">
                      {t('loadIntoEditor')}
                    </button>
                  </div>
                  <Code>{s.script[lang]}</Code>
                </div>
              ))}
            </div>
          )}

          {tab === 'ai' && (
            <div className="space-y-4">
              <p className="text-[13px] leading-relaxed text-ink/60">{c.aiIntro}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-ink/55">{c.idea}</span>
                  <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={2} placeholder={c.ideaPh} className={`${inputCls} resize-none`} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-ink/55">{c.language}</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                    {LANGS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-ink/55">{c.names}</span>
                  <input value={names} onChange={(e) => setNames(e.target.value)} placeholder={c.namesPh} className={inputCls} />
                </label>
                <div className="md:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold text-ink/55">{c.tone}</span>
                  <Segmented value={tone} onChange={setTone} options={TONES.map((x) => ({ value: x.id, label: x[lang] }))} />
                </div>
                <div className="md:col-span-2">
                  <Slider label={c.length} value={messages} min={8} max={45} step={1} onChange={setMessages} format={(v) => `${v} ${c.messagesUnit}`} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={prompt} label={c.copyPrompt} />
                <button
                  type="button"
                  onClick={async () => {
                    const txt = await navigator.clipboard.readText().catch(() => '')
                    const m = /```(?:text|txt)?\s*\n([\s\S]*?)```/.exec(txt)
                    const script = (m ? m[1] : txt).trim()
                    if (script) load(script)
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-bold ring-1 ring-ink/10 transition hover:ring-ink/25"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" /> {c.pasteScript}
                </button>
                <span className="text-[11px] text-ink/45">{c.howTo}</span>
              </div>
              <textarea
                readOnly
                value={prompt}
                rows={16}
                className="w-full rounded-2xl bg-cream p-4 font-mono text-[11.5px] leading-relaxed text-ink/75 ring-1 ring-ink/[0.08] outline-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
