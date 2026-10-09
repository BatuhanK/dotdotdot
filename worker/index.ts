/*
 * dotdotdot on Cloudflare Workers. The React app is served as static assets; this Worker answers:
 *
 *   POST   /api/shares                       publish a project      → { id, editToken }
 *   GET    /api/shares/:id                   a shared project and its media list
 *   PUT    /api/shares/:id                   update (edit token)
 *   DELETE /api/shares/:id                   stop sharing (edit token)
 *   PUT    /api/shares/:id/assets/:assetId   upload a media file (edit token)
 *   GET    /api/shares/:id/assets/:assetId   download a media file
 *   DELETE /api/admin/shares/:id             takedown (ADMIN_TOKEN secret)
 *   GET    /, /app, /s/:id                   the app, with link-preview tags for that page
 *
 * Errors are `{ error, code }` with a matching HTTP status (see ErrorCode in http.ts).
 */
import { Hono } from 'hono'
import { ApiError, type AppEnv } from './http'
import { pages } from './pages'
import { admin, shares } from './shares'

export { Quota } from './quota'

const app = new Hono<AppEnv>()

// API responses are never cached unless the route says otherwise.
app.use('/api/*', async (c, next) => {
  await next()
  if (!c.res.headers.has('cache-control')) c.res.headers.set('cache-control', 'no-store')
})

app.route('/api/shares', shares)
app.route('/api/admin', admin)
app.route('/', pages)

app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'Not found', code: 'not_found' }, 404) : c.env.ASSETS.fetch(c.req.raw)))

/** Above this, an unread request body is dropped instead of read to the end. */
const DRAIN_LIMIT = 1024 * 1024

app.onError(async (err, c) => {
  // A request rejected before its body was read: read a small body to the end so the connection can be reused,
  // and tell the runtime a big one won't be needed.
  const body = c.req.raw.body
  if (body && !body.locked) {
    const small = Number(c.req.header('content-length')) <= DRAIN_LIMIT
    await (small ? body.pipeTo(new WritableStream()) : body.cancel()).catch(() => {})
  }
  if (err instanceof ApiError) return c.json({ error: err.message, code: err.code }, err.status)
  console.error(JSON.stringify({ event: 'error', method: c.req.method, path: c.req.path, error: String(err), stack: err.stack }))
  return c.json({ error: 'Something went wrong', code: 'server_error' }, 500)
})

export default app
