import { create } from 'zustand'

export type UiLang = 'en' | 'tr'

const KEY = 'chatreel:ui-lang'

function initialLang(): UiLang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'tr') return saved
  } catch {
    /* ignore */
  }
  return typeof navigator !== 'undefined' && /^tr/i.test(navigator.language) ? 'tr' : 'en'
}

interface UiState {
  lang: UiLang
  setLang: (l: UiLang) => void
  guideOpen: boolean
  setGuideOpen: (v: boolean) => void
  advancedOpen: boolean
  setAdvancedOpen: (v: boolean) => void
}

export const useUi = create<UiState>((set) => ({
  lang: initialLang(),
  setLang(lang) {
    try {
      localStorage.setItem(KEY, lang)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang
    set({ lang })
  },
  guideOpen: false,
  setGuideOpen: (guideOpen) => set({ guideOpen }),
  advancedOpen: false,
  setAdvancedOpen: (advancedOpen) => set({ advancedOpen }),
}))
