import { BASE_TIMING } from './presets'
import { sanitizeProject } from './project-schema'
import type { Project } from './types'

export type SampleLang = 'en' | 'tr'

export interface Sample {
  id: string
  label: Record<SampleLang, string>
  script: Record<SampleLang, string>
}

/* Sample stories in every UI language. They use @settings so they look right whatever the editor is set to. */
export const SAMPLES: Sample[] = [
  {
    id: 'wrong-chat',
    label: { en: '😬 Sent to the wrong chat', tr: '😬 Yanlış gruba attım' },
    script: {
      en: `@preset natural
@language en
@time 21:41

--- Yesterday 6:02 PM ---
Jessica: coffee tomorrow?
Me: yes 10am ☕️
Jessica: deal 🤝
<start>
--- Today 9:41 PM ---
Jessica: hey are you awake?
Me: yeah what's up
<typing 2.4s>
Jessica: I need to tell you something
Jessica: but promise you won't be mad
Me: ...ok
Me: you're scaring me 😳
<wait 1s>
Jessica: I accidentally sent your text to the group chat
Me: WHICH text
Jessica: the one about Mike 💀
Me: NO <react 😂 Jessica>
Me: delete it <typo>right now
Jessica: I can't, it's been an hour
Jessica: he already replied
Me: what did he<pause 1.2s> say
<typing 3s>
Jessica: "see you at 8 then 😏"
Me: 😳😳`,
      tr: `@preset natural
@language tr
@time 21:41

--- Yesterday 18:02 ---
Ayşe: yarın kahve?
Ben: olur 10'da ☕️
Ayşe: anlaştık 🤝
<start>
--- Today 21:41 ---
Ayşe: uyanık mısın?
Ben: evet ne oldu
<typing 2.4s>
Ayşe: sana bir şey söylemem lazım
Ayşe: ama kızmayacağına söz ver
Ben: ...tamam
Ben: korkutuyorsun beni 😳
<wait 1s>
Ayşe: mesajını yanlışlıkla gruba attım
Ben: HANGİ mesajı
Ayşe: Mehmet hakkındakini 💀
Ben: HAYIR <react 😂 Ayşe>
Ben: hemen <typo>sil
Ayşe: silemiyorum 1 saat oldu
Ayşe: Mehmet cevap bile yazdı
Ben: ne<pause 1s> dedi
<typing 3s>
Ayşe: "o zaman 8'de görüşürüz 😏"
Ben: 😳😳`,
    },
  },
  {
    id: 'confession',
    label: { en: '💔 Typed it… deleted it', tr: '💔 Yazdım… sildim' },
    script: {
      en: `@preset drama
@language en
@title Alex
@time 23:52
@battery 9

--- Yesterday 7:14 PM ---
Alex: had fun tonight
Me: me too 🙂
<start>
--- Today 11:52 PM ---
Alex: you up?
Me: yeah
Alex: can I ask you something
Me: sure
<typing_stop Alex 2.5s>
<wait 1.5s>
Alex: do you still think about us
Me: I <mistake don't>do<pause 1.5s> sometimes
Me: why are you asking<clear>
<wait 1s>
Me: why now?
<typing 4s>
Alex: because I'm outside your door
Me: 😳`,
      tr: `@preset drama
@language tr
@title Deniz
@time 23:52
@battery 9

--- Yesterday 19:14 ---
Deniz: bugün çok güzeldi
Ben: bence de 🙂
<start>
--- Today 23:52 ---
Deniz: uyanık mısın?
Ben: evet
Deniz: bir şey sorabilir miyim
Ben: tabii
<typing_stop Deniz 2.5s>
<wait 1.5s>
Deniz: hâlâ bizi düşünüyor musun
Ben: <mistake hayır>evet<pause 1.5s> bazen
Ben: neden soruyorsun<clear>
<wait 1s>
Ben: neden şimdi?
<typing 4s>
Deniz: çünkü kapının önündeyim
Ben: 😳`,
    },
  },
  {
    id: 'group',
    label: { en: '👯 Group chat chaos', tr: '👯 Grup kaosu' },
    script: {
      en: `@preset viral
@language en
@app whatsapp
@group Bestie Squad 💅
@avatar Emma 🦋
@avatar Jake 🐸
@avatar Sophie 🌸
@time 20:15

--- Yesterday 9:02 PM ---
Emma: who's coming saturday??
Jake: me
Sophie: obviously 💃
<start>
--- Today 8:15 PM ---
Emma: guys
Emma: I need to tell you something
<typing_stop Jake 1.5s>
Sophie: omg what
<typing 3s>
Emma: I'm moving to Paris 🇫🇷
Jake: WHAT
Sophie: NO <react 😢 Jake>
Me: wait<pause 1s> for real??
Emma: for real 😭
<renamed Emma's Goodbye Tour ✈️ by Sophie>
Jake: ok we're making this the best month ever
Me: I'm crying <react ❤️ Emma>`,
      tr: `@preset viral
@language tr
@app whatsapp
@group Kankalar 💅
@avatar Elif 🦋
@avatar Can 🐸
@avatar Zeynep 🌸
@time 20:15

--- Yesterday 21:02 ---
Elif: cumartesi kim geliyor??
Can: ben
Zeynep: tabii ki 💃
<start>
--- Today 20:15 ---
Elif: arkadaşlar
Elif: size bir şey söylemem lazım
<typing_stop Can 1.5s>
Zeynep: ne oldu
<typing 3s>
Elif: Paris'e taşınıyorum 🇫🇷
Can: NE
Zeynep: HAYIR <react 😢 Can>
Ben: dur<pause 1s> ciddi misin??
Elif: ciddiyim 😭
<renamed Elif'in Veda Turu ✈️ by Zeynep>
Can: tamam bu ayı efsane yapıyoruz
Ben: ağlıyorum <react ❤️ Elif>`,
    },
  },
  {
    id: 'mom',
    label: { en: '📱 Mom learns texting', tr: '📱 Annem mesajlaşmayı öğreniyor' },
    script: {
      en: `@preset natural
@language en
@app whatsapp
@title Mom ❤️
@time 20:12

Mom: Hello this is your mother
Mom: Are you eating
Me: hi mom yes
Mom: What did you eat
Me: pasta
<typing 3.5s>
Mom: Ok. Your aunt says hi. LOL
Me: mom you know LOL means laugh out loud right
<typing_stop Mom 2s>
<wait 1s>
Mom: Oh no
Mom: I thought it meant lots of love
Mom: I sent it to Mrs. Patterson when her cat died
Me: 💀💀💀`,
      tr: `@preset natural
@language tr
@app whatsapp
@title Annem ❤️
@time 20:12

Annem: Merhaba ben annen
Annem: Yemek yedin mi
Ben: selam anne evet
Annem: Ne yedin
Ben: makarna
<typing 3.5s>
Annem: Tamam. Teyzen selam söylüyor. LOL
Ben: anne LOL gülmek demek biliyorsun di mi
<typing_stop Annem 2s>
<wait 1s>
Annem: Eyvah
Annem: Ben çok sevgiler demek sanıyordum
Annem: Ayşe teyzeye kedisi ölünce yazdım
Ben: 💀💀💀`,
    },
  },
]

/** Sample script that is the same story in another language (for switching languages). */
export function translateSample(script: string, to: SampleLang): string | null {
  for (const s of SAMPLES) for (const lang of Object.keys(s.script) as SampleLang[]) if (s.script[lang] === script) return s.script[to]
  return null
}

export function defaultProject(lang: SampleLang = 'en'): Project {
  return {
    version: 1,
    app: 'imessage',
    appearance: 'light',
    locale: 'en',
    clock24: false,
    device: 'iphone-17-pro',
    layout: 'fullscreen',
    splitRatio: 0.58,
    fps: 30,
    resolution: 1080,
    background: { kind: 'gradient', color: '#1F2A44', color2: '#7A3E9D', asset: null, dim: 0 },
    status: { time: '9:41', battery: 82, signal: 4, wifi: true, charging: false, showIsland: false },
    chat: {
      title: '',
      subtitle: '',
      avatar: null,
      service: 'imessage',
      unread: 0,
      wallpaper: null,
      showEncryptionNotice: true,
      localizeStamps: true,
      group: false,
      clock: '21:41',
    },
    participants: [],
    script: SAMPLES[0].script[lang],
    timing: { ...BASE_TIMING },
    preset: 'natural',
    receipts: 'read',
    keyboard: 'typing',
    sound: { enabled: true, volume: 0.8, keyboardClicks: true, music: null, musicVolume: 0.35, videoAudio: false },
  }
}

/** A valid project from stored or shared JSON: fills in fields added since it was saved and drops anything invalid. */
export function migrateProject(raw: unknown): Project {
  return sanitizeProject(raw, defaultProject())
}
