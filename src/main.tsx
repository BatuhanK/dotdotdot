import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Root } from './Root'

if (import.meta.env.DEV) {
  void Promise.all([import('./dev/fidelity'), import('./lib/store'), import('./lib/ui-store')]).then(([m, store, ui]) => {
    Object.assign(window as unknown as Record<string, unknown>, { __cvm: m, __store: store.useStore, __ui: ui.useUi })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
