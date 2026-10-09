/*
 * The app's pages. Every page is the same index.html (a single-page app); the Worker only fills in the
 * title, description and Open Graph / Twitter tags, so shared links get a rich preview.
 */
import { Hono } from 'hono'
import { type AppEnv, PAGE_HEADERS } from './http'
import { loadShare, SHARE_ID } from './shares'

const SITE_NAME = 'dotdotdot'
/** Bump when public/og.png or og-app.png change: link previews cache images by URL. */
const OG_VERSION = 2

interface PageMeta {
  title: string
  description: string
  image: string
  url: string
  /** Keep the page out of search results (shared stories are user content). */
  noindex?: boolean
}

const HOME = {
  title: `${SITE_NAME} · iMessage & WhatsApp text story videos`,
  description: 'Write a conversation and get a video that looks like a real iMessage or WhatsApp screen recording. Free, no sign-up, no watermark.',
}
const EDITOR = {
  title: `${SITE_NAME} · Make your text story video`,
  description: 'Write the chat, pick iMessage or WhatsApp and download a video that looks like a real iPhone screen recording. Right in your browser.',
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** The app's index.html, fetched fresh (no conditional headers) so it can be rewritten. */
function appShell(env: Env, url: URL): Promise<Response> {
  return env.ASSETS.fetch(new URL('/', url))
}

function withMeta(page: Response, m: PageMeta): Response {
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeAttr(m.title)}" />`,
    `<meta property="og:description" content="${escapeAttr(m.description)}" />`,
    `<meta property="og:url" content="${escapeAttr(m.url)}" />`,
    `<meta property="og:image" content="${escapeAttr(m.image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttr(m.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(m.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(m.image)}" />`,
    m.noindex ? `<meta name="robots" content="noindex" />` : '',
  ].join('')
  const html = new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(m.title)
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute('content', m.description)
      },
    })
    .on('head', {
      element(el) {
        el.append(tags, { html: true })
      },
    })
    .transform(page)
  const headers = new Headers(html.headers)
  // The HTML now differs per URL, so the asset's ETag no longer describes it.
  headers.delete('etag')
  // Vite's dev server injects inline scripts, so the policy only applies to the built site.
  if (!import.meta.env.DEV) for (const [name, value] of Object.entries(PAGE_HEADERS)) headers.set(name, value)
  if (m.noindex) headers.set('x-robots-tag', 'noindex')
  return new Response(html.body, { status: html.status, headers })
}

export const pages = new Hono<AppEnv>()

pages.get('/', async (c) => {
  const url = new URL(c.req.url)
  return withMeta(await appShell(c.env, url), { ...HOME, image: `${url.origin}/og.png?v=${OG_VERSION}`, url: `${url.origin}/` })
})

pages.get('/app', async (c) => {
  const url = new URL(c.req.url)
  return withMeta(await appShell(c.env, url), { ...EDITOR, image: `${url.origin}/og-app.png?v=${OG_VERSION}`, url: `${url.origin}/app` })
})

/** A shared story. Unknown ids still get the app (it shows "not found"). */
pages.get(`/s/:id{${SHARE_ID}}`, async (c) => {
  const url = new URL(c.req.url)
  const [page, rec] = await Promise.all([appShell(c.env, url), loadShare(c.env, c.req.param('id'))])
  const app = (rec?.app ?? rec?.project?.app) === 'whatsapp' ? 'WhatsApp' : 'iMessage'
  const thumb = rec?.assets.some((a) => a.id === 'thumb')
  return withMeta(page, {
    title: rec?.title ? `${rec.title} · ${SITE_NAME}` : `A chat story made with ${SITE_NAME}`,
    description: rec ? `Watch this ${app} story, then make your own text story video in seconds.` : HOME.description,
    // The version makes link previews pick up a new picture after an update.
    image: rec && thumb ? `${url.origin}/api/shares/${rec.id}/assets/thumb?v=${rec.updatedAt}` : `${url.origin}/og.png?v=${OG_VERSION}`,
    url: url.toString(),
    noindex: true,
  })
})
