/*
 * Single source of truth for the script language documentation:
 * used by the Script guide modal and by the prompt we hand to LLM agents.
 */

type L = { en: string; tr: string }

export interface TagDoc {
  syntax: string
  aliases?: string[]
  /** line: on its own line (applies to the next message) · inline: inside a message · both. */
  where: 'line' | 'inline' | 'both'
  desc: L
  example: string
}

export interface TagGroup {
  title: L
  intro?: L
  tags: TagDoc[]
}

export const BASICS: { syntax: string; desc: L }[] = [
  {
    syntax: 'Jessica: hey are you up?',
    desc: { en: 'A message. Everything before the first ":" is the sender’s name.', tr: 'Bir mesaj. İlk ":" işaretinden önceki kısım gönderenin adıdır.' },
  },
  {
    syntax: 'Me: yeah why',
    desc: {
      en: '"Me" (or Ben, I, You…) is the phone owner — shown on the right in blue. Change it with @me or in People.',
      tr: '"Me" (veya Ben, I, You…) telefonun sahibidir — sağda mavi görünür. @me ile ya da Kişiler bölümünden değiştirebilirsin.',
    },
  },
  {
    syntax: '  …and this continues it',
    desc: { en: 'A line without "Name:" continues the previous message on a new line.', tr: '"İsim:" ile başlamayan satır önceki mesajın yeni satırı olur.' },
  },
  {
    syntax: '--- Yesterday 7:14 PM ---',
    desc: {
      en: 'A timestamp. Write it in English (Today, Yesterday, Monday, Mar 14 + a time) — it is shown in the phone language and clock format ("Dün 19:14"). Its time also sets the clock for later messages.',
      tr: 'Zaman damgası. İngilizce yazabilirsin (Today, Yesterday, Monday, Mar 14 + saat) — telefonun dilinde ve saat formatında gösterilir ("Dün 19:14"). İçindeki saat sonraki mesajların saatini de ayarlar.',
    },
  },
  { syntax: '# a note to yourself', desc: { en: 'Comment — ignored.', tr: 'Yorum — yok sayılır.' } },
  {
    syntax: '@theme dark',
    desc: { en: 'A setting (see Settings). Usually at the top of the script.', tr: 'Bir ayar (bkz. Ayarlar). Genelde script’in başına yazılır.' },
  },
]

export const TAG_GROUPS: TagGroup[] = [
  {
    title: { en: 'Conversation history (already on screen)', tr: 'Geçmiş mesajlar (başta ekranda)' },
    intro: {
      en: 'Start the video in the middle of a conversation. History messages are visible from the first frame — no typing, no sounds, no animation.',
      tr: 'Videoyu bir sohbetin ortasında başlat. Geçmiş mesajlar ilk kareden itibaren görünür — yazma, ses ve animasyon yok.',
    },
    tags: [
      {
        syntax: '<start>',
        aliases: ['<begin>', '<now>', '<live>'],
        where: 'line',
        desc: {
          en: 'Everything above this line is already on screen when the video starts. Everything below plays live.',
          tr: 'Bu satırın üstündeki her şey video başladığında ekranda hazırdır. Altındakiler canlı oynar.',
        },
        example: '--- Yesterday 7:14 PM ---\nAyşe: akşama gelsene\nMe: olurrr\n<start>\n--- Today 11:32 AM ---\nAyşe: dün çok güzeldi',
      },
      {
        syntax: '<history> … </history>',
        where: 'line',
        desc: { en: 'Alternative: wrap the earlier messages in a block.', tr: 'Alternatif: önceki mesajları bir blok içine al.' },
        example: '<history>\nMom: call me when you land\nMe: ok ❤️\n</history>',
      },
    ],
  },
  {
    title: { en: 'Typing on my keyboard (inside my messages)', tr: 'Klavyemde yazma (benim mesajlarımın içinde)' },
    intro: {
      en: 'These play while YOU type the message on the iOS keyboard (keyboard mode "Keyboard + typing" or "always open"). The bubble only shows the final text.',
      tr: 'Bunlar mesajı SEN iOS klavyesinde yazarken oynar (klavye modu "Klavye + yazma" ya da "hep açık"). Balonda sadece son metin görünür.',
    },
    tags: [
      {
        syntax: '<pause 1.5s>',
        aliases: ['<mid_type_wait 1.5s>', '<think 1.5s>'],
        where: 'inline',
        desc: { en: 'Stop typing for a moment at this point (thinking).', tr: 'Bu noktada bir süre yazmayı bırak (düşünme).' },
        example: 'Me: I think I lo<pause 1.5s>ve you',
      },
      {
        syntax: '<typo>',
        aliases: ['<oops>'],
        where: 'inline',
        desc: { en: 'Hit the neighbouring key of the next letter, notice it and backspace it.', tr: 'Sonraki harfin yanındaki tuşa bas, fark et ve sil.' },
        example: 'Me: see you <typo>tomorrow',
      },
      {
        syntax: '<mistake text>',
        aliases: ['<wrong text>', '<retype text>'],
        where: 'inline',
        desc: {
          en: 'Type "text", pause, delete it all, then continue. Perfect for changing your mind.',
          tr: '"text"i yaz, dur, hepsini sil, sonra devam et. Fikir değiştirmek için birebir.',
        },
        example: 'Me: I <mistake hate>love you',
      },
      {
        syntax: '<del 4>',
        aliases: ['<backspace 4>', '<delete 4>'],
        where: 'inline',
        desc: { en: 'Backspace the last 4 characters you typed.', tr: 'Yazdığın son 4 karakteri sil.' },
        example: 'Me: I love<del 4>like you',
      },
      {
        syntax: '<clear>',
        aliases: ['<delete_all>', '<erase>'],
        where: 'inline',
        desc: {
          en: 'Delete everything typed so far. If nothing is typed after it, the message is never sent.',
          tr: 'O ana kadar yazılanı tamamen sil. Ardından bir şey yazılmazsa mesaj hiç gönderilmez.',
        },
        example: 'Me: I miss you<pause 2s><clear>',
      },
      {
        syntax: '<speed 2>',
        aliases: ['<fast>', '<slow>', '<normal>'],
        where: 'inline',
        desc: {
          en: 'Change typing speed from here on (2 = twice as fast, <fast> = 1.8, <slow> = 0.5).',
          tr: 'Buradan sonra yazma hızını değiştir (2 = iki kat hızlı, <fast> = 1.8, <slow> = 0.5).',
        },
        example: 'Me: <slow>please<fast> PLEASE ANSWER',
      },
    ],
  },
  {
    title: { en: 'Timing (on its own line, applies to the next message)', tr: 'Zamanlama (kendi satırında, bir sonraki mesaja uygulanır)' },
    intro: {
      en: 'Write these on a line before a message — or right after "Name:" at the start of the message.',
      tr: 'Bunları bir mesajdan önceki satıra — ya da mesajın başında "İsim:"den hemen sonra — yaz.',
    },
    tags: [
      {
        syntax: '<typing 3s>',
        where: 'both',
        desc: {
          en: 'Their message: how long the typing bubble shows. My message: how long I type it.',
          tr: 'Karşı tarafın mesajı: "yazıyor" balonunun süresi. Benim mesajım: yazma süresi.',
        },
        example: '<typing 4s>\nAlex: I have to tell you something',
      },
      {
        syntax: '<wait 2s>',
        aliases: ['<delay 2s>'],
        where: 'both',
        desc: { en: 'Silence before the next message.', tr: 'Bir sonraki mesajdan önce sessizlik.' },
        example: '<wait 2s>\nMe: hello??',
      },
      {
        syntax: '<hold 3s>',
        aliases: ['<read 3s>'],
        where: 'both',
        desc: {
          en: 'Reading time after the message appears (overrides the automatic one).',
          tr: 'Mesaj göründükten sonraki okuma süresi (otomatik süreyi geçersiz kılar).',
        },
        example: '<hold 3s>\nJessica: I’m pregnant',
      },
      {
        syntax: '<instant>',
        where: 'both',
        desc: { en: 'My next message appears without being typed (like pasting).', tr: 'Bir sonraki mesajım yazılmadan direkt düşer (yapıştırmak gibi).' },
        example: 'Me: <instant>https://maps.app/xyz',
      },
      {
        syntax: '<typing_stop Alex 2s>',
        aliases: ['<fake_typing Alex 2s>'],
        where: 'line',
        desc: {
          en: 'Alex starts typing… then stops. No message arrives. Name is optional (defaults to the other person).',
          tr: 'Alex yazmaya başlar… sonra durur. Mesaj gelmez. İsim isteğe bağlı (varsayılan: karşı taraf).',
        },
        example: '<typing_stop Alex 2.5s>',
      },
      {
        syntax: '<time Today 9:41 PM>',
        where: 'line',
        desc: { en: 'Same as --- Today 9:41 PM --- .', tr: '--- Bugün 21:41 --- ile aynı.' },
        example: '<time Yesterday 11:02 PM>',
      },
    ],
  },
  {
    title: { en: 'Group chats', tr: 'Grup sohbetleri' },
    intro: {
      en: 'Write 3+ different names and it becomes a group chat automatically: names above messages, avatars next to them, member avatars in the header, no read receipts (like iOS). Name the group with @group, give people emoji avatars with @avatar. Group events are translated to the phone language.',
      tr: '3+ farklı isim yazınca otomatik grup sohbeti olur: mesajların üstünde isimler, yanlarında avatarlar, başlıkta üye avatarları, okundu bilgisi yok (iOS gibi). Gruba @group ile isim ver, kişilere @avatar ile emoji avatar ver. Grup olayları telefon diline çevrilir.',
    },
    tags: [
      {
        syntax: '<added Can by Ayşe>',
        aliases: ['<add …>', '<joined …>'],
        where: 'line',
        desc: {
          en: '"Ayşe added Can to the conversation". Without "by …" it is "You added …".',
          tr: '"Ayşe, Can adlı kişiyi sohbete ekledi". "by …" yoksa "… ekledin" olur.',
        },
        example: '<added Can by Ayşe>\nCan: hi guys 👋',
      },
      {
        syntax: '<removed Can by Ayşe>',
        aliases: ['<kicked …>'],
        where: 'line',
        desc: { en: '"Ayşe removed Can from the conversation".', tr: '"Ayşe, Can adlı kişiyi sohbetten çıkardı".' },
        example: '<removed Mehmet by Ayşe>',
      },
      {
        syntax: '<left Mehmet>',
        aliases: ['<leave …>'],
        where: 'line',
        desc: { en: '"Mehmet left the conversation". <left> alone = you left.', tr: '"Mehmet sohbetten ayrıldı". Tek başına <left> = sen ayrıldın.' },
        example: 'Mehmet: I’m done with you all\n<left Mehmet>',
      },
      {
        syntax: '<renamed Party 🎉 by Ayşe>',
        aliases: ['<rename …>', '<named …>'],
        where: 'line',
        desc: {
          en: '"Ayşe named the conversation “Party 🎉”" — the header title changes at that moment.',
          tr: '"Ayşe sohbetin adını “Party 🎉” olarak değiştirdi" — başlık o anda değişir.',
        },
        example: '<renamed Emma’s Goodbye Tour ✈️ by Sophie>',
      },
      {
        syntax: '<group_photo by Ayşe>',
        where: 'line',
        desc: { en: '"Ayşe changed the group photo".', tr: '"Ayşe grup fotoğrafını değiştirdi".' },
        example: '<group_photo by Jake>',
      },
      {
        syntax: '<system any text>',
        where: 'line',
        desc: { en: 'A centred grey notice with your own text (not translated).', tr: 'Kendi metninle ortada gri bir bildirim (çevrilmez).' },
        example: '<system Messages are end-to-end encrypted>',
      },
    ],
  },
  {
    title: { en: 'Reactions & photos', tr: 'Tepkiler ve fotoğraflar' },
    tags: [
      {
        syntax: '<react 😂>',
        aliases: ['{😂}'],
        where: 'inline',
        desc: {
          en: 'A tapback on this message from the other person. Use any emoji, or heart, like, dislike, haha, !!, ?.',
          tr: 'Bu mesaja karşı taraftan tepki. Herhangi bir emoji veya heart, like, dislike, haha, !!, ? kullanılabilir.',
        },
        example: 'Me: I got the job <react ❤️>',
      },
      {
        syntax: '<react ❤️ Jessica>',
        aliases: ['{❤️ Jessica}'],
        where: 'inline',
        desc: {
          en: 'A tapback from a specific person (useful in group chats, or to react to your own message).',
          tr: 'Belirli bir kişiden tepki (grup sohbetlerinde ya da kendi mesajına tepki için).',
        },
        example: 'Jake: who’s in? <react 👍 Emma>',
      },
      {
        syntax: '<image>',
        aliases: ['[image]', '<photo>'],
        where: 'inline',
        desc: { en: 'A photo message. Upload the photo in the Messages tab.', tr: 'Fotoğraf mesajı. Fotoğrafı Mesajlar sekmesinden yükle.' },
        example: 'Jessica: <image>',
      },
    ],
  },
]

export interface SettingDoc {
  key: string
  values: string
  desc: L
}

export const SETTING_DOCS: SettingDoc[] = [
  {
    key: '@preset',
    values: 'natural · viral · drama · fast-texter · careful · parent · instant',
    desc: { en: 'Realism preset for typing speed, typos and pauses.', tr: 'Yazma hızı, hatalar ve molalar için gerçekçilik preseti.' },
  },
  { key: '@keyboard', values: 'off · typing · always', desc: { en: 'How my messages are sent.', tr: 'Benim mesajlarımın nasıl gönderileceği.' } },
  { key: '@typos', values: 'off · low · medium · high · 0–0.15', desc: { en: 'How often I hit a neighbouring key.', tr: 'Yan tuşa ne sıklıkla bastığım.' } },
  { key: '@typing_speed', values: '4–25', desc: { en: 'My typing speed in characters per second.', tr: 'Yazma hızım (saniyede karakter).' } },
  {
    key: '@their_typing_speed',
    values: '4–25',
    desc: { en: 'Controls how long their typing bubbles last.', tr: 'Karşı tarafın "yazıyor" balonlarının süresini belirler.' },
  },
  {
    key: '@hesitation',
    values: 'off · low · medium · high',
    desc: { en: 'How often I stop typing to think.', tr: 'Yazarken ne sıklıkla düşünmek için durduğum.' },
  },
  { key: '@speed', values: '0.5–2.5', desc: { en: 'Global speed of the whole video.', tr: 'Tüm videonun genel hızı.' } },
  { key: '@me', values: 'Name', desc: { en: 'Who the phone owner is (right side).', tr: 'Telefonun sahibi kim (sağ taraf).' } },
  {
    key: '@group',
    values: 'name · on · off',
    desc: { en: 'Name the group (or force group style with only two people).', tr: 'Gruba isim ver (veya sadece iki kişiyle grup görünümünü zorla).' },
  },
  {
    key: '@avatar',
    values: 'Name 🦋 [#ffd6e0]',
    desc: {
      en: 'Emoji avatar for a person, optional background colour. Use one line per person.',
      tr: 'Bir kişi için emoji avatar, isteğe bağlı arka plan rengi. Her kişi için ayrı satır.',
    },
  },
  {
    key: '@title',
    values: 'text',
    desc: { en: 'Name in the chat header (e.g. a group name or "Mom ❤️").', tr: 'Sohbet başlığındaki isim (ör. grup adı veya "Annem ❤️").' },
  },
  { key: '@app', values: 'imessage · whatsapp', desc: { en: 'Which messenger the video shows.', tr: 'Videoda hangi uygulama görünecek.' } },
  { key: '@theme', values: 'light · dark', desc: { en: 'Light or dark mode.', tr: 'Açık veya koyu mod.' } },
  { key: '@bubbles', values: 'blue · green', desc: { en: 'iMessage (blue) or SMS (green).', tr: 'iMessage (mavi) veya SMS (yeşil).' } },
  {
    key: '@language',
    values: 'en · tr · es · de · fr · pt',
    desc: { en: 'Language of the phone (Delivered/Read, Today…).', tr: 'Telefonun dili (İletildi/Okundu, Bugün…).' },
  },
  { key: '@clock', values: '12h · 24h', desc: { en: 'Clock format.', tr: 'Saat formatı.' } },
  {
    key: '@time',
    values: '21:41',
    desc: { en: 'Time the chat happens (timestamps, read receipts).', tr: 'Sohbetin saati (zaman damgaları, okundu bilgisi).' },
  },
  { key: '@status_time', values: '9:41', desc: { en: 'Time in the status bar.', tr: 'Durum çubuğundaki saat.' } },
  { key: '@battery', values: '1–100', desc: { en: 'Battery level (≤20 turns red).', tr: 'Pil seviyesi (≤20 kırmızı olur).' } },
  { key: '@receipts', values: 'read · delivered · none', desc: { en: 'Read receipts under my messages.', tr: 'Mesajlarımın altındaki okundu bilgisi.' } },
  { key: '@typing_indicator', values: 'on · off', desc: { en: 'Their typing bubble before replies.', tr: 'Cevaplardan önce karşı tarafın "yazıyor" balonu.' } },
  { key: '@device', values: 'iphone-17-pro · iphone-17-pro-max · iphone-16 · iphone-14 · iphone-se', desc: { en: 'Phone model.', tr: 'Telefon modeli.' } },
  { key: '@layout', values: 'fullscreen · mockup · split', desc: { en: 'Video layout.', tr: 'Video düzeni.' } },
  {
    key: '@timestamps',
    values: 'auto · literal',
    desc: {
      en: 'auto (default): translate timestamps into the phone language. literal: show them exactly as written.',
      tr: 'auto (varsayılan): zaman damgalarını telefon diline çevir. literal: yazıldığı gibi göster.',
    },
  },
  {
    key: '@seed',
    values: 'any number',
    desc: { en: 'Changes where the random typos and pauses happen.', tr: 'Rastgele hataların ve molaların yerini değiştirir.' },
  },
  {
    key: '@rhythm',
    values: '0–0.8',
    desc: { en: 'How uneven my keystrokes are (0 = robotic).', tr: 'Tuş vuruşlarımın ne kadar düzensiz olduğu (0 = robot gibi).' },
  },
  {
    key: '@late_typos',
    values: '0–1',
    desc: { en: 'Chance a typo is noticed a letter or two late.', tr: 'Bir hatanın bir-iki harf sonra fark edilme olasılığı.' },
  },
  {
    key: '@pause_length',
    values: '0.6-1.6',
    desc: { en: 'Min–max seconds of my random thinking pauses.', tr: 'Rastgele düşünme molalarımın en az–en çok süresi (sn).' },
  },
  {
    key: '@keyboard_open',
    values: '0.2–1.5',
    desc: { en: 'Seconds between the keyboard opening and the first key.', tr: 'Klavye açılması ile ilk tuş arasındaki saniye.' },
  },
  {
    key: '@keyboard_linger',
    values: '0–3',
    desc: { en: 'Seconds the keyboard stays up after sending.', tr: 'Gönderdikten sonra klavyenin açık kaldığı saniye.' },
  },
  {
    key: '@typing_stops',
    values: '0–1',
    desc: { en: 'Chance they stop typing and start again before a reply.', tr: 'Karşı tarafın cevaptan önce yazmayı bırakıp tekrar başlama olasılığı.' },
  },
  {
    key: '@typing_min / @typing_max',
    values: 'seconds',
    desc: { en: 'Shortest / longest automatic typing bubble.', tr: 'En kısa / en uzun otomatik "yazıyor" balonu.' },
  },
  {
    key: '@read_base / @read_per_char / @read_max',
    values: 'seconds',
    desc: { en: 'Automatic reading time after each message.', tr: 'Her mesajdan sonraki otomatik okuma süresi.' },
  },
  {
    key: '@start_delay / @end_hold',
    values: 'seconds',
    desc: { en: 'Empty time at the start / end of the video.', tr: 'Videonun başında / sonunda boş kalan süre.' },
  },
]

export const EXAMPLE_SCRIPT = `@preset drama
@title Alex
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
Me: 😳 <react ❤️ Alex>`

// ------------------------------------------------------------------------------------------------
// Prompt for LLM agents

export interface PromptOptions {
  idea: string
  language: string
  messages: number
  tone: string
  names: string
}

export function buildAgentPrompt(o: PromptOptions): string {
  const tags = TAG_GROUPS.flatMap((g) => g.tags)
    .map((t) => `- ${t.syntax}${t.aliases?.length ? ` (aliases: ${t.aliases.join(', ')})` : ''} — ${t.desc.en} Example: \`${t.example.replace(/\n/g, ' ⏎ ')}\``)
    .join('\n')
  const settings = SETTING_DOCS.map((s) => `- ${s.key} ${s.values} — ${s.desc.en}`).join('\n')
  return `You are a scriptwriter for dotdotdot, a tool that turns a chat script into a realistic iPhone screen recording of an iMessage or WhatsApp chat (vertical video for TikTok, Instagram Reels and YouTube Shorts). Write ONE script for the story below.

# Story request
- Idea: ${o.idea || '(surprise me — a relatable, viral-worthy situation)'}
- Language of the messages: ${o.language}
- Length: about ${o.messages} messages
- Tone: ${o.tone}
- People: ${o.names || 'pick natural names; the phone owner is "Me"'}

# Output format
Reply with the script only, inside a single \`\`\`text code block. No explanations before or after.

# Script language
Each line is one of:
- \`Name: message\` — a message. "Me" is the phone owner (right side). Everyone else appears on the left. More than two people = group chat (set a group name with @title).
- A line without "Name:" continues the previous message on a new line (use rarely).
- \`--- Today 9:41 PM ---\` — a timestamp separator. Always write timestamps in English (Today / Yesterday / a weekday / "Mar 14" + a time); they are translated to the phone language automatically.
- \`<start>\` — everything above it is already on screen when the video begins (conversation history); everything below plays live.
- \`@setting value\` — settings, put them at the very top.
- \`# comment\` — ignored.
- A line with only tags (e.g. \`<typing 3s>\` or \`<wait 2s>\`) — applies to the next message.

Tags:
${tags}

Settings:
${settings}

Durations are seconds ("2s", "1.5s"). Use only the tags and settings listed above; anything else in <...> is shown literally.

# How to write a great one
- Give context with history: put 2–6 earlier messages (under a \`--- Yesterday 7:14 PM ---\` timestamp) above \`<start>\`, then a \`--- Today … ---\` timestamp and the live conversation. Viewers see the backstory instantly.
- Hook in the first 2–3 live messages: a question, a confession, a weird request, a mistake.
- Group chats (3+ names) make great chaos: give each person a distinct voice, set @group and an @avatar per person, and use group events for drama (<added …>, <left …>, <renamed …>).
- Keep messages short and real (2–12 words), casual spelling, lowercase where natural, emoji where people would actually use them.
- Build tension, then deliver a twist or punchline in the last 1–3 messages. End on a reaction (😳, 💀, a single word).
- Choreograph the drama with tags, sparingly: <typing_stop> before a big reveal, <mistake ...> or <clear> when "Me" changes their mind, <pause> mid-sentence for hesitation, <typo> for realism, <typing 4s> before a long or shocking reply, <wait> for silence, <react> to land a joke.
- Typing tags (<pause>, <typo>, <mistake>, <del>, <clear>, <speed>) only animate on "Me" messages; on other people they only make the typing bubble pause.
- Set the mood with settings: @preset (drama for suspense, viral for fast comedy), @time (late night feels intimate), @battery (low battery adds stress), @title. Add \`@app whatsapp\` if the story asks for WhatsApp (or fits it, like a family group); leave it out for iMessage.
- ${o.messages} messages ≈ ${Math.round(o.messages * 2.4)}–${Math.round(o.messages * 3.2)} seconds of video.

# Example
\`\`\`text
${EXAMPLE_SCRIPT}
\`\`\``
}
