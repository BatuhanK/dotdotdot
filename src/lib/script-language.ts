import { StreamLanguage } from '@codemirror/language'
import { highlightCode, Tag, tagHighlighter, tags } from '@lezer/highlight'
import { ME_ALIASES, participantId, TAG_ALIASES } from './script'

/**
 * Syntax highlighting for the script language, shared by the editor (CodeMirror) and the
 * script guide (static code samples). Every token kind gets a `.tok-<kind>` class; the colors
 * live in index.css.
 */

const KNOWN_TAGS = new Set(Object.keys(TAG_ALIASES))

// Token names must not clash with CodeMirror's legacy ones ("tag", "meta", "string"…), which win over tokenTable.
const T = {
  me: Tag.define(),
  name: Tag.define(),
  cue: Tag.define(),
  react: Tag.define(),
  stamp: Tag.define(),
  setting: Tag.define(),
}

export const chatScript = StreamLanguage.define<{ me: string[] }>({
  name: 'chatscript',
  startState: () => ({ me: [] }),
  copyState: (s) => ({ me: [...s.me] }),
  token(stream, state) {
    if (stream.sol()) {
      if (stream.match(/^\s*(#|\/\/).*/)) return 'comment'
      // "@me Ayşe" makes Ayşe the phone owner: color her lines like "Me".
      const me = stream.match(/^\s*@\s*me\s+(.+)$/i, false) as RegExpMatchArray | null
      if (me) state.me = [...state.me, participantId(me[1])]
      if (stream.match(/^\s*@\s*[a-z_]+/i)) return 'setting'
      if (stream.match(/^\s*-{2,}.*-{2,}\s*$/)) return 'stamp'
      const speaker = stream.match(/^[^:<>[\]{}#@\n]{1,40}?:/) as RegExpMatchArray | null
      if (speaker) {
        const id = participantId(speaker[0].slice(0, -1))
        return ME_ALIASES.has(id) || state.me.includes(id) ? 'me' : 'name'
      }
    }
    const tag = stream.match(/^<\s*([a-z_]+)[^<>]*>/i) as RegExpMatchArray | null
    if (tag) return KNOWN_TAGS.has(tag[1].toLowerCase()) ? 'cue' : null
    if (stream.match(/^\[\s*(typing|type|wait|pause|delay|hold|read|image|photo|img|pic|foto|resim)\b[^\]]*\]/i)) return 'cue'
    if (stream.match(/^\{[^}]*\}/)) return 'react'
    stream.next()
    return null
  },
  tokenTable: T,
})

export const scriptHighlighter = tagHighlighter([
  { tag: tags.comment, class: 'tok-comment' },
  { tag: T.me, class: 'tok-me' },
  { tag: T.name, class: 'tok-name' },
  { tag: T.cue, class: 'tok-tag' },
  { tag: T.react, class: 'tok-react' },
  { tag: T.stamp, class: 'tok-stamp' },
  { tag: T.setting, class: 'tok-setting' },
])

/** Split a script into highlighted pieces (for read-only samples). */
export function highlightScript(code: string): { text: string; cls: string }[] {
  const out: { text: string; cls: string }[] = []
  highlightCode(
    code,
    chatScript.parser.parse(code),
    scriptHighlighter,
    (text, cls) => out.push({ text, cls }),
    () => out.push({ text: '\n', cls: '' }),
  )
  return out
}
