import { useEffect, useRef } from 'react'
import { Annotation, EditorState, StateEffect, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, keymap, placeholder, type DecorationSet } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting } from '@codemirror/language'
import { chatScript, scriptHighlighter } from '../lib/script-language'
import { useStore } from '../lib/store'

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent', color: '#1a1200' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: '1.7' },
  '.cm-content': { padding: '12px 0', caretColor: '#ff9f0a' },
  '.cm-line': { padding: '0 16px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: '#ff9f0a', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(255,184,0,0.28) !important' },
  '.cm-selected-msg': { backgroundColor: 'rgba(255,201,51,0.2)', boxShadow: 'inset 3px 0 0 #ffb800' },
  '.cm-error-line': { backgroundColor: 'rgba(239,68,68,0.08)', boxShadow: 'inset 3px 0 0 #ef4444' },
  '.cm-placeholder': { color: 'rgba(26,18,0,0.3)' },
})

/** Marks transactions that sync the editor to the store (so they aren't echoed back). */
const External = Annotation.define<boolean>()

const setMarks = StateEffect.define<{ selected: [number, number] | null; errors: number[] }>()
const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (!e.is(setMarks)) continue
      const doc = tr.state.doc
      const ranges = []
      const lines = new Set<number>()
      if (e.value.selected) for (let l = e.value.selected[0]; l <= e.value.selected[1]; l++) lines.add(l)
      for (let l = 0; l < doc.lines; l++) {
        if (e.value.errors.includes(l)) ranges.push(Decoration.line({ class: 'cm-error-line' }).range(doc.line(l + 1).from))
        else if (lines.has(l)) ranges.push(Decoration.line({ class: 'cm-selected-msg' }).range(doc.line(l + 1).from))
      }
      deco = Decoration.set(ranges, true)
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

export function ScriptEditor() {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const script = useStore((s) => s.project.script)
  const parsed = useStore((s) => s.parsed)
  const selectedId = useStore((s) => s.selectedId)

  useEffect(() => {
    const extensions: Extension[] = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      chatScript,
      syntaxHighlighting(scriptHighlighter),
      theme,
      marksField,
      EditorView.lineWrapping,
      placeholder('@preset natural\n\nJessica: hey are you up?\nMe: yeah<pause 1s> why?'),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !u.transactions.some((tr) => tr.annotation(External))) {
          useStore.getState().setScript(u.state.doc.toString())
        }
        if (u.selectionSet && u.view.hasFocus) {
          const line = u.state.doc.lineAt(u.state.selection.main.head).number - 1
          const msg = useStore.getState().parsed.messages.find((m) => line >= m.blockStart && line <= m.lineEnd)
          // Clicking (or typing) in a message moves the video to it.
          if (msg && msg.id !== useStore.getState().selectedId) useStore.getState().jumpTo(msg.id)
        }
      }),
    ]
    view.current = new EditorView({
      state: EditorState.create({ doc: useStore.getState().project.script, extensions }),
      parent: host.current!,
    })
    if (import.meta.env.DEV) (window as unknown as { __cm: EditorView | null }).__cm = view.current
    return () => view.current?.destroy()
  }, [])

  // External script changes (list editor, samples, undo, language switch).
  useEffect(() => {
    const v = view.current
    if (!v) return
    const cur = v.state.doc.toString()
    if (cur !== script) v.dispatch({ changes: { from: 0, to: cur.length, insert: script }, annotations: External.of(true) })
  }, [script])

  useEffect(() => {
    const v = view.current
    if (!v) return
    const msg = parsed.messages.find((m) => m.id === selectedId)
    v.dispatch({
      effects: setMarks.of({ selected: msg ? [msg.line, msg.lineEnd] : null, errors: parsed.errors.map((e) => e.line) }),
    })
    // Follow the video (the selection moves with playback) unless the user is typing here.
    if (msg && !v.hasFocus && msg.line < v.state.doc.lines) {
      v.dispatch({ effects: EditorView.scrollIntoView(v.state.doc.line(msg.line + 1).from, { y: 'nearest', yMargin: 80 }) })
    }
  }, [parsed, selectedId])

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />
}
