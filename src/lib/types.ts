export type AppKind = 'imessage' | 'whatsapp'
export type Appearance = 'light' | 'dark'
export type ChatLocale = 'en' | 'tr' | 'es' | 'de' | 'fr' | 'pt'
export type LayoutKind = 'fullscreen' | 'mockup' | 'split'
export type ReceiptMode = 'read' | 'delivered' | 'none'
export type BackgroundKind = 'color' | 'gradient' | 'image' | 'video'
/** off: my messages pop in · typing: keyboard opens while I type · always: keyboard stays open. */
export type KeyboardMode = 'off' | 'typing' | 'always'
export type DeviceId = 'iphone-17-pro' | 'iphone-17-pro-max' | 'iphone-16' | 'iphone-14' | 'iphone-se'

export interface Participant {
  /** Lower-cased name, used as key. */
  id: string
  name: string
  isMe: boolean
  avatar: string | null
  /** Emoji avatar (used when there is no photo). */
  emoji?: string
  /** Background colour for the emoji avatar. */
  color?: string
}

/** Group chat events ("Ayşe added Can to the conversation"). Actor/target are names as written. */
export interface SystemEvent {
  type: 'added' | 'removed' | 'left' | 'renamed' | 'photo' | 'custom'
  actor?: string
  target?: string
  /** New group name (renamed) or the literal text (custom). */
  text?: string
}

export interface Reaction {
  emoji: string
  /** Participant id of the reactor. Empty string = "the other side". */
  from: string
}

/** Keystroke choreography inside a message (only played when I type on the keyboard). */
export type TypingOp =
  | { kind: 'type'; text: string }
  | { kind: 'pause'; seconds: number }
  | { kind: 'typo' }
  | { kind: 'mistake'; text: string }
  | { kind: 'del'; count: number }
  | { kind: 'clear' }
  | { kind: 'speed'; factor: number }

export type MessageKind = 'text' | 'image' | 'timestamp' | 'pause' | 'typing' | 'system'

export interface Message {
  id: string
  kind: MessageKind
  /** Participant id (text / image / typing). Empty = the other side. */
  from?: string
  /** Final text shown in the bubble (after applying the typing ops). */
  text?: string
  /** Original content after "Name:" including tags — used for lossless editing. */
  raw?: string
  /** Asset id of an attached image (kind = image). */
  image?: string | null
  reactions?: Reaction[]
  ops?: TypingOp[]
  /** Extra pause before this item, seconds. */
  wait?: number
  /** Typing duration override, seconds (incoming: indicator, outgoing: keyboard). */
  typing?: number
  /** Reading time after this item appears, seconds. */
  hold?: number
  /** My message appears without being typed on the keyboard. */
  instant?: boolean
  /** Already on screen when the video starts (written before <start> or inside <history>). */
  history?: boolean
  system?: SystemEvent
  /** First and last script line (0-based, inclusive) this message came from. */
  line: number
  lineEnd: number
  /** Script line where the directives belonging to this message start. */
  blockStart: number
}

export interface Background {
  kind: BackgroundKind
  color: string
  color2: string
  asset: string | null
  /** 0..1 darken overlay on top of image / video backgrounds. */
  dim: number
}

export interface StatusBar {
  time: string
  battery: number
  signal: number
  wifi: boolean
  charging: boolean
  /** Draw the Dynamic Island / notch (it never appears in real screen recordings). */
  showIsland: boolean
}

export interface Timing {
  /** Global speed multiplier. 1 = natural, 2 = twice as fast. */
  speed: number
  startDelay: number
  endHold: number
  /** Their typing bubble before each reply. */
  typingIndicator: boolean
  /** Their typing duration = clamp(chars / typingCps, min, max). */
  typingCps: number
  minTyping: number
  maxTyping: number
  /** Chance that they stop typing for a moment and start again. */
  typingStops: number
  /** Hold after a message = clamp(readBase + chars * readPerChar, readMin, readMax). */
  readBase: number
  readPerChar: number
  readMin: number
  readMax: number
  /** My keyboard typing speed, characters per second. */
  keyboardCps: number
  /** 0..1 variation between keystrokes. */
  jitter: number
  /** Chance per letter of hitting a neighbouring key (then deleting it). */
  typoRate: number
  /** Chance that a typo is only noticed one or two letters later. */
  lateTypo: number
  /** Chance per message of stopping mid-typing to think. */
  hesitation: number
  hesitationMin: number
  hesitationMax: number
  /** Seconds between the keyboard opening and the first keystroke. */
  keyboardOpen: number
  /** Seconds the keyboard stays open after sending (typing mode). */
  keyboardLinger: number
  /** Random seed for all human-like variation. */
  seed: number
}

export interface Project {
  version: 1
  app: AppKind
  appearance: Appearance
  locale: ChatLocale
  clock24: boolean
  device: DeviceId
  layout: LayoutKind
  /** Fraction of the frame height the chat takes in split layout. */
  splitRatio: number
  fps: 30 | 60
  resolution: 1080 | 720
  background: Background
  status: StatusBar
  chat: {
    /** Header title. Empty = name of the first participant who is not me. */
    title: string
    /** WhatsApp header subtitle ("online", "last seen today at 21:40"…). */
    subtitle: string
    /** Header avatar. null = use the first non-me participant's avatar. */
    avatar: string | null
    /** iMessage (blue) or SMS (green) outgoing bubbles. */
    service: 'imessage' | 'sms'
    /** Unread badge on the back button (0 = hidden). */
    unread: number
    /** Chat wallpaper asset (WhatsApp); null = default doodle wallpaper. */
    wallpaper: string | null
    showEncryptionNotice: boolean
    /** Translate timestamps ("Yesterday 7:14 PM") into the phone language. */
    localizeStamps: boolean
    /** Show as a group chat even with only two people. */
    group: boolean
    /** Clock shown in WhatsApp bubbles / iMessage receipts. */
    clock: string
  }
  participants: Participant[]
  script: string
  timing: Timing
  /** Realism preset the timing was last set from ('' = custom). */
  preset: string
  receipts: ReceiptMode
  keyboard: KeyboardMode
  sound: {
    enabled: boolean
    volume: number
    keyboardClicks: boolean
    music: string | null
    musicVolume: number
    videoAudio: boolean
  }
}
