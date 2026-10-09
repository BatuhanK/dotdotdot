import { Fragment, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Copy, Play, Sparkles } from 'lucide-react'
import { SAMPLES } from '../lib/defaults'
import { buildAgentPrompt } from '../lib/script-docs'
import type { AppKind } from '../lib/types'
import { useUi, type UiLang } from '../lib/ui-store'
import { Logo } from '../components/Logo'
import { LivePhone } from './LivePhone'

const APPS: { id: AppKind; name: string }[] = [
  { id: 'imessage', name: 'iMessage' },
  { id: 'whatsapp', name: 'WhatsApp' },
]

const COPY: Record<
  UiLang,
  {
    docTitle: string
    nav: { features: string; examples: string; ai: string; open: string }
    /** Label of the iMessage / WhatsApp switch under the hero phone (for screen readers). */
    appSwitch: string
    /** Headline: text before the highlighted part, the highlight, text after. */
    title: [string, string, string]
    sub: string
    cta: string
    cta2: string
    badges: string[]
    chips: string[]
    featuresTitle: string
    features: { emoji: string; title: string; desc: string; tint: string }[]
    howTitle: string
    steps: { title: string; desc: string }[]
    galleryTitle: string
    gallerySub: string
    gallerySubTouch: string
    remix: string
    aiTitle: string
    aiDesc: string
    aiCopy: string
    aiCopied: string
    /** The little script shown in the AI section. */
    sample: { name: string; me: string; first: string; pre: string; mistake: string; typed: string; post: string; last: string }
    finalTitle: string
    footer: string
    legal: string
    bubbles: string[]
  }
> = {
  en: {
    docTitle: 'dotdotdot · iMessage & WhatsApp text story videos',
    nav: { features: 'Features', examples: 'Examples', ai: 'Write with AI', open: 'Open app' },
    appSwitch: 'Show the chat in',
    title: ['They’ll think it’s a ', 'screen recording', '.'],
    sub: 'You write the texts, the video’s ready in seconds.',
    cta: 'Make your first video',
    cta2: 'See examples',
    badges: ['Free', 'No sign-up', 'No watermark'],
    chips: [
      '😳 plot twists',
      '💀 sent it to the wrong chat',
      '🫥 blue ticks, no reply',
      '👀 left on read',
      '⌨️ typed… deleted',
      '👵 the family group chat',
      '👯 group chat chaos',
      '🫠 typing for 10 minutes',
      '🌙 2am texts',
      '💔 the ex texted',
      '🤖 let AI write it',
      '🔗 send the link',
    ],
    featuresTitle: 'The little details make it believable',
    features: [
      {
        emoji: '📱',
        title: 'iMessage or WhatsApp',
        desc: 'Pick the app. We put each one side by side with the real thing and fixed every pixel that was off. Bubbles, ticks, wallpaper, even the tiny tails. The sounds are the real ones too.',
        tint: '#DCEBFF',
      },
      {
        emoji: '⌨️',
        title: 'Types like a person',
        desc: 'The keyboard slides up, a key gets missed and fixed. Sometimes a whole message gets deleted before it’s sent. You know, like you do at 2am.',
        tint: '#FFE7C2',
      },
      {
        emoji: '👯',
        title: 'Group chats too',
        desc: 'Someone gets added, someone leaves, and someone renames the group right in the middle of the drama. You know how it goes.',
        tint: '#FFDDE8',
      },
      {
        emoji: '🤖',
        title: 'Out of ideas? Ask AI',
        desc: 'Paste our prompt into ChatGPT or Claude, tell it your idea and drop the answer in here. It even writes the pauses and the typos.',
        tint: '#E4DCFF',
      },
      {
        emoji: '⚡️',
        title: 'Ready in seconds',
        desc: 'The video is made right on your device, so there’s no upload and no waiting in line. 1080p, 60fps, no watermark.',
        tint: '#D8F5DE',
      },
      {
        emoji: '🔗',
        title: 'Send it as a link',
        desc: 'Drop the link in the group chat. Friends can watch it, download it or make their own version.',
        tint: '#FFF1B8',
      },
    ],
    howTitle: 'If you can text, you can do this.',
    steps: [
      { title: 'Write the chat', desc: 'One message per line, like a script. Type “Me: omg” and your first message is done.' },
      { title: 'Set the mood', desc: 'iMessage or WhatsApp? Fast and funny or slow and tense? Dark mode, which iPhone, even the battery at 9%.' },
      { title: 'Download and post', desc: 'Save the vertical video and post it to TikTok, Reels or Shorts.' },
    ],
    galleryTitle: 'A few stories to start with',
    gallerySub: 'Hover to watch, click to make it yours',
    gallerySubTouch: 'Tap one to make it yours',
    remix: 'Try it',
    aiTitle: 'Let AI write the drama',
    aiDesc:
      'Copy our prompt, paste it into ChatGPT or Claude and tell it what happens. Paste the answer back here and you’re done. It even comes up with the pauses, the typos and the twist at the end.',
    aiCopy: 'Copy the prompt',
    aiCopied: 'Copied! Now paste it into your AI',
    sample: { name: 'Alex', me: 'Me', first: 'you up?', pre: 'I ', mistake: 'don’t', typed: 'do', post: ' sometimes', last: 'I’m outside your door' },
    finalTitle: 'Got a story in your head? Write it down.',
    footer: 'For people with stories to tell.',
    legal: 'iMessage is a trademark of Apple Inc. and WhatsApp is a trademark of WhatsApp LLC. dotdotdot is not affiliated with Apple or Meta.',
    bubbles: ['you up?', 'I need to tell you something', 'wait what 😳'],
  },
  tr: {
    docTitle: 'dotdotdot · iMessage ve WhatsApp mesajlaşma videoları',
    nav: { features: 'Özellikler', examples: 'Örnekler', ai: 'AI ile yaz', open: 'Hemen dene' },
    appSwitch: 'Sohbeti şurada göster',
    title: ['', 'Ekran kaydı', ' sanacaklar.'],
    sub: 'Mesajları sen yaz, videosu saniyeler içinde hazır.',
    cta: 'İlk videonu yap',
    cta2: 'Örneklere bak',
    badges: ['Ücretsiz', 'Üye olmadan', 'Filigransız'],
    chips: [
      '😳 ters köşe',
      '💀 yanlış gruba attım',
      '🫥 mavi tik, cevap yok',
      '👀 görüldü attı',
      '⌨️ yazdı… sildi',
      '👵 aile grubu',
      '👯 grup kaosu',
      '🫠 10 dakikadır yazıyor',
      '🌙 gece 2 mesajları',
      '💔 eski sevgili yazdı',
      '🤖 AI yazsın',
      '🔗 linki at',
    ],
    featuresTitle: 'Gerçek gibi durmasının sırrı detaylarda',
    features: [
      {
        emoji: '📱',
        title: 'iMessage mı, WhatsApp mı?',
        desc: 'Uygulamayı sen seç. İkisini de gerçeğiyle yan yana koyup tutmayan her pikseli düzelttik. Balonlar, tikler, duvar kağıdı, o minik kuyruklar bile. Sesler de gerçeğinin aynısı.',
        tint: '#DCEBFF',
      },
      {
        emoji: '⌨️',
        title: 'İnsan gibi yazıyor',
        desc: 'Klavye açılır, bir harf yanlış basılır, hemen düzeltilir. Bazen koca mesaj gönderilmeden silinir. Hani gece 2’de sen de yaparsın ya.',
        tint: '#FFE7C2',
      },
      {
        emoji: '👯',
        title: 'Grup sohbetleri de var',
        desc: 'Biri eklenir, biri çıkar, biri de tam ortalık karışmışken grubun adını değiştirir. Bilirsin işte.',
        tint: '#FFDDE8',
      },
      {
        emoji: '🤖',
        title: 'Fikir mi yok? AI’a sor',
        desc: 'Promptumuzu ChatGPT ya da Claude’a yapıştır, aklındaki fikri anlat, gelen cevabı buraya koy. Duraksamaları, yazım hatalarını bile o yazar.',
        tint: '#E4DCFF',
      },
      {
        emoji: '⚡️',
        title: 'Saniyeler içinde hazır',
        desc: 'Video doğrudan senin cihazında oluşuyor; yükleme yok, sıra beklemek yok. 1080p, 60fps ve filigransız.',
        tint: '#D8F5DE',
      },
      {
        emoji: '🔗',
        title: 'Link olarak gönder',
        desc: 'Linki gruba at. Arkadaşların izleyebilir, indirebilir ya da kendi versiyonunu yapabilir.',
        tint: '#FFF1B8',
      },
    ],
    howTitle: 'Mesaj atabiliyorsan bunu da yaparsın.',
    steps: [
      { title: 'Sohbeti yaz', desc: 'Her satıra bir mesaj, senaryo yazar gibi. “Ben: eyvah” yazdığın an ilk mesaj hazır.' },
      { title: 'Havasını seç', desc: 'iMessage mı WhatsApp mı? Hızlı mı aksın, gerilimli mi? Koyu mod, hangi iPhone, hatta %9 pil.' },
      { title: 'İndir, paylaş', desc: 'Dikey videoyu indir, TikTok’a, Reels’e ya da Shorts’a at.' },
    ],
    galleryTitle: 'Başlaman için birkaç hikaye',
    gallerySub: 'Üzerine gelince oynar, tıklayınca senin olur',
    gallerySubTouch: 'Birine dokun, senin olsun',
    remix: 'Dene',
    aiTitle: 'Dramayı AI yazsın',
    aiDesc:
      'Promptumuzu kopyala, ChatGPT ya da Claude’a yapıştır ve ne olacağını anlat. Gelen cevabı buraya yapıştırman yeterli. Duraksamaları, yazım hatalarını, sondaki ters köşeyi bile o düşünür.',
    aiCopy: 'Promptu kopyala',
    aiCopied: 'Kopyalandı, şimdi AI’a yapıştır',
    sample: { name: 'Deniz', me: 'Ben', first: 'uyudun mu?', pre: '', mistake: 'uyuyordum', typed: 'yok', post: ', uyanığım', last: 'kapının önündeyim' },
    finalTitle: 'Aklında bir hikaye mi var? Yaz gitsin.',
    footer: 'Anlatacak hikayesi olanlar için.',
    legal: 'iMessage, Apple Inc.’in; WhatsApp, WhatsApp LLC’nin ticari markasıdır. dotdotdot’un Apple ya da Meta ile bir bağlantısı yoktur.',
    bubbles: ['uyudun mu?', 'sana bir şey söylemem lazım', 'ciddi misin 😳'],
  },
}

/** Adds .in to every .reveal element when it scrolls into view. */
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), {
      threshold: 0.15,
    })
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  })
}

/** Small app marks: a blue iMessage bubble and a round green WhatsApp bubble. */
function AppGlyph({ app, className = 'h-4 w-4' }: { app: AppKind; className?: string }) {
  return app === 'whatsapp' ? (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path d="M10 1.6a8.4 8.4 0 0 0-7.3 12.6L1.6 18.4l4.3-1.1A8.4 8.4 0 1 0 10 1.6Z" fill="#25D366" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path
        d="M10 2.4c4.8 0 8.6 3.1 8.6 7s-3.8 7-8.6 7c-.8 0-1.6-.1-2.4-.3-1.3 1-2.9 1.6-4.6 1.7.8-.7 1.4-1.6 1.6-2.6C2.8 14 1.4 11.8 1.4 9.4c0-3.9 3.8-7 8.6-7Z"
        fill="#0A84FF"
      />
    </svg>
  )
}

function Bubble({
  children,
  mine,
  app = 'imessage',
  className = '',
  style,
}: {
  children: React.ReactNode
  mine?: boolean
  app?: AppKind
  className?: string
  style?: React.CSSProperties
}) {
  const look = !mine
    ? 'bg-white text-[#1A1200]'
    : app === 'whatsapp'
      ? 'bg-[#D9FDD3] text-[#1A1200]'
      : 'bg-gradient-to-b from-[#5AC8FA] to-[#0A84FF] text-white'
  return (
    <div
      className={`float-y absolute rounded-[20px] px-4 py-2.5 text-[15px] font-semibold whitespace-nowrap shadow-[0_12px_30px_-12px_rgba(60,40,0,0.35)] ${look} ${className}`}
      style={style}
    >
      {children}
      {mine && app === 'whatsapp' && (
        // WhatsApp's blue "read" ticks
        <svg
          viewBox="0 0 18 12"
          className="ml-1.5 inline-block h-3 w-[18px] align-[-1px]"
          fill="none"
          stroke="#53BDEB"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M1 6.5l3.2 3.1L10.5 2.5M6.4 8.4l1.2 1.2L13.9 2.5" />
        </svg>
      )}
    </div>
  )
}

function TypingBubble({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`float-y absolute flex gap-1.5 rounded-[20px] bg-white px-4 py-3.5 shadow-[0_12px_30px_-12px_rgba(60,40,0,0.35)] ${className}`}
      style={style}
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="dot-bounce h-2.5 w-2.5 rounded-full bg-[#8E8E93]" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}

// Phones and tablets can't hover: there the example cards just play while on screen.
const CAN_HOVER = typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches

function GalleryCard({ sampleId, lang, remix, tilt }: { sampleId: string; lang: UiLang; remix: string; tilt: number }) {
  const s = SAMPLES.find((x) => x.id === sampleId)!
  const [hover, setHover] = useState(false)
  const app: AppKind = /^@app\s+(whatsapp|wa)\b/im.test(s.script[lang]) ? 'whatsapp' : 'imessage'
  return (
    <a
      href={`/app?sample=${s.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="reveal group block"
      style={{ transitionDelay: `${tilt * 40}ms` }}
    >
      <div className="squish relative" style={{ transform: `rotate(${tilt * 1.5}deg)` }}>
        <LivePhone script={s.script[lang]} active={hover || !CAN_HOVER} />
        <span
          className="absolute -top-2.5 -left-2 z-10 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-extrabold shadow-[0_6px_14px_-6px_rgba(60,40,0,0.45)] ring-1 ring-black/5"
          style={{ transform: `rotate(${-tilt * 5}deg)` }}
        >
          <AppGlyph app={app} className="h-3.5 w-3.5" /> {APPS.find((a) => a.id === app)!.name}
        </span>
      </div>
      <div className="mt-4 flex flex-col items-start gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm leading-tight font-bold sm:text-[15px]">{s.label[lang]}</span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#1A1200] px-3 py-1.5 text-xs font-bold text-white transition group-hover:bg-[#FFB800] group-hover:text-[#1A1200]">
          {remix} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </a>
  )
}

export default function Landing() {
  const lang = useUi((s) => s.lang)
  const setLang = useUi((s) => s.setLang)
  const c = COPY[lang]
  const [copied, setCopied] = useState(false)
  const heroPhone = useRef<HTMLDivElement>(null)
  // The hero phone takes turns between the apps after each play-through, until the visitor picks one.
  const [heroApp, setHeroApp] = useState<AppKind>(lang === 'tr' ? 'whatsapp' : 'imessage')
  const [heroPinned, setHeroPinned] = useState(false)
  const [heroSwapped, setHeroSwapped] = useState(false)
  const showHeroApp = (app: AppKind) => {
    if (app === heroApp) return
    setHeroApp(app)
    setHeroSwapped(true)
  }
  useReveal()

  useEffect(() => {
    document.title = COPY[lang].docTitle
    document.documentElement.lang = lang
  }, [lang])

  // The hero phone leans towards the cursor.
  useEffect(() => {
    const el = heroPhone.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const move = (e: PointerEvent) => {
      const x = e.clientX / innerWidth - 0.5
      const y = e.clientY / innerHeight - 0.5
      el.style.transform = `perspective(1200px) rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  const heroScript = SAMPLES[0].script[lang]
  const [before, mark, after] = c.title
  const afterWords = after.trim().split(' ').filter(Boolean)
  const x = c.sample

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#FFFBF1] font-rounded text-[#1A1200] selection:bg-[#FFD666]">
      {/* soft background blobs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="blob absolute -top-40 -left-32 h-[420px] w-[420px] rounded-full bg-[#FFE08A]/50 blur-3xl" />
        <div className="blob absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-[#BFE0FF]/50 blur-3xl" style={{ animationDelay: '-5s' }} />
        <div className="blob absolute bottom-0 left-1/4 h-[380px] w-[380px] rounded-full bg-[#FFC9DA]/40 blur-3xl" style={{ animationDelay: '-9s' }} />
      </div>

      <div className="relative z-10">
        <nav className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-5 sm:gap-6">
          <a href="/" aria-label="dotdotdot">
            <Logo className="text-lg sm:text-xl" markClassName="h-8 w-8 sm:h-9 sm:w-9" animated />
          </a>
          <div className="ml-6 hidden gap-6 text-[15px] font-semibold text-black/60 md:flex">
            <a href="#features" className="hover:text-black">
              {c.nav.features}
            </a>
            <a href="#examples" className="hover:text-black">
              {c.nav.examples}
            </a>
            <a href="#ai" className="hover:text-black">
              {c.nav.ai}
            </a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-full bg-black/[0.06] p-0.5 text-xs font-bold">
              {(['en', 'tr'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`rounded-full px-2.5 py-1 uppercase transition ${lang === l ? 'bg-white shadow-sm' : 'text-black/45 hover:text-black'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <a href="/app" className="squish rounded-full bg-[#1A1200] px-4 py-2.5 text-sm font-bold whitespace-nowrap text-white sm:px-5">
              {c.nav.open}
            </a>
          </div>
        </nav>

        {/* ---------------------------------------------------------------- hero */}
        <header className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-6 pb-20 md:grid-cols-[1.1fr_0.9fr] md:pt-12">
          <div>
            <div className="pop-in mb-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-bold shadow-sm ring-1 ring-black/5 backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#FFB000]" /> iMessage · WhatsApp · iOS 26
            </div>
            {/* Words are separate inline blocks so they can pop in one by one; real spaces keep the text copyable. */}
            <h1 className="text-[40px] leading-[1.02] text-balance font-extrabold tracking-[-0.03em] sm:text-6xl md:text-7xl">
              {before
                .split(' ')
                .filter(Boolean)
                .map((w, i) => (
                  <Fragment key={i}>
                    <span className="pop-in inline-block" style={{ animationDelay: `${i * 70}ms` }}>
                      {w}
                    </span>{' '}
                  </Fragment>
                ))}
              <span className="pop-in relative inline-block whitespace-nowrap" style={{ animationDelay: '350ms' }}>
                <span className="absolute inset-x-[-0.08em] bottom-[0.08em] -z-10 h-[0.42em] -rotate-1 rounded-full bg-[#FFC933]" />
                {mark}
              </span>
              {after.startsWith(' ') && ' '}
              {afterWords.map((w, i) => (
                <Fragment key={`a${i}`}>
                  {i > 0 && ' '}
                  <span className="pop-in inline-block" style={{ animationDelay: `${450 + i * 70}ms` }}>
                    {w}
                  </span>
                </Fragment>
              ))}
            </h1>
            <p className="pop-in mt-6 max-w-xl text-lg leading-relaxed font-medium text-pretty text-black/60 sm:text-xl" style={{ animationDelay: '500ms' }}>
              {c.sub}
            </p>
            <div className="pop-in mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: '600ms' }}>
              <a
                href="/app"
                className="squish flex items-center gap-2 rounded-full bg-[#FFB800] px-7 py-4 text-lg font-extrabold shadow-[0_14px_30px_-10px_rgba(255,170,0,0.75)]"
              >
                {c.cta} <ArrowRight className="h-5 w-5" />
              </a>
              <a href="#examples" className="squish flex items-center gap-2 rounded-full bg-white px-6 py-4 text-lg font-bold shadow-sm ring-1 ring-black/10">
                <Play className="h-5 w-5" fill="currentColor" /> {c.cta2}
              </a>
            </div>
            <div className="pop-in mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-black/55" style={{ animationDelay: '700ms' }}>
              {c.badges.map((b) => (
                <span key={b} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#34C759]" strokeWidth={3} /> {b}
                </span>
              ))}
            </div>
          </div>

          <div className="pop-in mx-auto w-[270px] sm:w-[300px]" style={{ animationDelay: '250ms' }}>
            <div className="relative">
              <div ref={heroPhone} className="transition-transform duration-300 ease-out">
                <div key={heroApp} className={heroSwapped ? 'app-swap' : ''}>
                  <LivePhone
                    script={heroScript}
                    app={heroApp}
                    onLoop={heroPinned ? undefined : () => showHeroApp(heroApp === 'imessage' ? 'whatsapp' : 'imessage')}
                  />
                </div>
              </div>
              {/* Side bubbles hang off the phone; between md and xl the phone sits at the screen edge, so they tuck in there. */}
              <Bubble className="top-16 right-[calc(100%+1.75rem)] hidden sm:block" style={{ ['--r' as string]: '-6deg', animationDelay: '-1s' }}>
                {c.bubbles[0]}
              </Bubble>
              <Bubble
                mine
                app={heroApp}
                className="top-44 left-[calc(100%-1.25rem)] hidden sm:block md:left-auto md:-right-6 xl:right-auto xl:left-[calc(100%-1.25rem)]"
                style={{ ['--r' as string]: '5deg', animationDelay: '-2.5s' }}
              >
                {c.bubbles[2]}
              </Bubble>
              <TypingBubble className="-left-16 bottom-28 hidden sm:flex" style={{ ['--r' as string]: '4deg', animationDelay: '-3.5s' }} />
              <div
                className="float-y absolute -right-10 -bottom-4 text-5xl md:-right-3 xl:-right-10"
                style={{ ['--r' as string]: '12deg', animationDelay: '-2s' }}
              >
                💀
              </div>
              <div className="float-y absolute -top-6 -left-8 text-4xl" style={{ ['--r' as string]: '-12deg', animationDelay: '-4s' }}>
                😳
              </div>
            </div>
            <div
              role="group"
              aria-label={c.appSwitch}
              className="relative mx-auto mt-8 flex w-fit gap-1 rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-black/5 backdrop-blur"
            >
              {APPS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={heroApp === a.id}
                  onClick={() => {
                    setHeroPinned(true)
                    showHeroApp(a.id)
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-extrabold transition ${heroApp === a.id ? 'bg-[#1A1200] text-white shadow-sm' : 'text-black/55 hover:text-black'}`}
                >
                  <AppGlyph app={a.id} /> {a.name}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ---------------------------------------------------------------- chips marquee */}
        <div className="relative -rotate-1 overflow-hidden border-y-2 border-[#1A1200] bg-[#FFC933] py-4">
          <div className="marquee flex w-max gap-4">
            {[...c.chips, ...c.chips].map((chip, i) => (
              <span key={i} className="rounded-full bg-[#FFFBF1] px-5 py-2 text-base font-bold whitespace-nowrap ring-2 ring-[#1A1200]">
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* ---------------------------------------------------------------- features */}
        <section id="features" className="mx-auto max-w-6xl px-5 py-24">
          <h2 className="reveal mx-auto max-w-2xl text-center text-4xl font-extrabold tracking-[-0.02em] text-balance sm:text-5xl">{c.featuresTitle}</h2>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.map((f, i) => (
              <div
                key={f.title}
                className="reveal squish rounded-[28px] p-7 ring-1 ring-black/5"
                style={{ background: f.tint, transitionDelay: `${(i % 3) * 90}ms` }}
              >
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/80 text-3xl shadow-sm">{f.emoji}</div>
                <h3 className="text-xl font-extrabold">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed font-medium text-pretty text-black/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- how it works */}
        <section className="bg-[#1A1200] py-24 text-[#FFFBF1]">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="reveal text-center text-4xl font-extrabold tracking-[-0.02em] text-balance sm:text-5xl">{c.howTitle}</h2>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {c.steps.map((s, i) => (
                <div key={s.title} className="reveal rounded-[28px] bg-white/[0.06] p-7 ring-1 ring-white/10" style={{ transitionDelay: `${i * 120}ms` }}>
                  <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-[#FFC933] text-xl font-extrabold text-[#1A1200]">{i + 1}</div>
                  <h3 className="text-2xl font-extrabold">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed font-medium text-pretty text-white/60">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- gallery */}
        <section id="examples" className="mx-auto max-w-6xl px-5 py-24">
          <h2 className="reveal text-center text-4xl font-extrabold tracking-[-0.02em] text-balance sm:text-5xl">{c.galleryTitle}</h2>
          <p className="reveal mt-3 text-center text-base font-semibold text-black/50">{CAN_HOVER ? c.gallerySub : c.gallerySubTouch}</p>
          <div className="mt-14 grid grid-cols-2 gap-6 md:grid-cols-4">
            {SAMPLES.map((s, i) => (
              <GalleryCard key={s.id} sampleId={s.id} lang={lang} remix={c.remix} tilt={i % 2 ? 1 : -1} />
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- AI */}
        <section id="ai" className="mx-auto max-w-6xl px-5 pb-24">
          <div className="reveal grid items-center gap-10 overflow-hidden rounded-[36px] bg-gradient-to-br from-[#E4DCFF] to-[#FFDDE8] p-8 sm:p-12 md:grid-cols-2">
            <div>
              <div className="mb-4 text-5xl">🤖</div>
              <h2 className="text-4xl font-extrabold tracking-[-0.02em] text-balance">{c.aiTitle}</h2>
              <p className="mt-4 text-lg leading-relaxed font-medium text-pretty text-black/60">{c.aiDesc}</p>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    buildAgentPrompt({
                      idea: '',
                      language: lang === 'tr' ? 'Turkish' : 'English',
                      messages: 18,
                      tone: 'dramatic, suspenseful, with a plot twist',
                      names: '',
                    }),
                  )
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="squish mt-7 flex items-center gap-2 rounded-full bg-[#1A1200] px-6 py-3.5 font-bold text-white"
              >
                {copied ? <Check className="h-5 w-5 text-[#FFC933]" /> : <Copy className="h-5 w-5" />} {copied ? c.aiCopied : c.aiCopy}
              </button>
            </div>
            {/* Wraps instead of scrolling sideways on phones. */}
            <pre className="rounded-3xl bg-[#1A1200] p-6 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap text-[#FFFBF1] shadow-2xl">
              <span className="text-[#C4B5FD]">
                @preset drama{'\n'}@app whatsapp{'\n'}@title {x.name}
              </span>
              {'\n\n'}
              <span className="text-[#7DD3FC]">{x.name}:</span> {x.first}
              {'\n'}
              <span className="text-[#7DD3FC]">{x.me}:</span> {x.pre}
              <span className="text-[#FFC933]">&lt;mistake {x.mistake}&gt;</span>
              {x.typed}
              <span className="text-[#FFC933]">&lt;pause 1.5s&gt;</span>
              {x.post}
              {'\n'}
              <span className="text-[#FFC933]">&lt;typing_stop {x.name} 2s&gt;</span>
              {'\n'}
              <span className="text-[#7DD3FC]">{x.name}:</span> {x.last}
              {'\n'}
              <span className="text-[#7DD3FC]">{x.me}:</span> 😳 <span className="text-[#F9A8D4]">&lt;react ❤️ {x.name}&gt;</span>
            </pre>
          </div>
        </section>

        {/* ---------------------------------------------------------------- final CTA */}
        <section className="mx-auto max-w-4xl px-5 pb-28 text-center">
          <h2 className="reveal text-4xl font-extrabold tracking-[-0.02em] text-balance sm:text-6xl">{c.finalTitle}</h2>
          <a
            href="/app"
            className="reveal squish mt-10 inline-flex items-center gap-2 rounded-full bg-[#FFB800] px-9 py-5 text-xl font-extrabold shadow-[0_18px_36px_-12px_rgba(255,170,0,0.8)]"
          >
            {c.cta} <ArrowRight className="h-6 w-6" />
          </a>
        </section>

        <footer className="border-t border-black/10 px-5 py-8 text-center text-sm font-medium text-black/45">
          <div className="font-bold text-black/70">© 2026 dotdotdot · {c.footer}</div>
          <div className="mt-1 text-xs">{c.legal}</div>
        </footer>
      </div>
    </div>
  )
}
