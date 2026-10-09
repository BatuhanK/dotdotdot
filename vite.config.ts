import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Where `window.__cvm` (src/dev/fidelity.ts) saves rendered frames in development. Git-ignored. */
const SHOTS_DIR = resolve('.shots')

/** Dev-only endpoint the fidelity tooling posts rendered frames to. */
function devShots(): Plugin {
  return {
    name: 'dev-shots',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        const url = new URL(req.url ?? '', 'http://x')
        const name = (url.searchParams.get('name') ?? 'shot').replace(/[^\w.-]/g, '_').replace(/^\.+$/, 'shot')
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          mkdirSync(SHOTS_DIR, { recursive: true })
          writeFileSync(join(SHOTS_DIR, name), Buffer.concat(chunks))
          res.end('ok')
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare(), devShots()],
  server: { port: 5199 },
  // The MP4 encoder chunk (~540 kB) is only loaded when someone exports.
  build: { chunkSizeWarningLimit: 600 },
})
