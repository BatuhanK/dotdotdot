import type { ContentfulStatusCode } from 'hono/utils/http-status'

export type AppEnv = { Bindings: Env }

/** Machine-readable reasons, so the app can explain a failure in the user's language. */
export type ErrorCode =
  'invalid_request' | 'not_found' | 'unauthorized' | 'length_required' | 'too_large' | 'unsupported_media' | 'rate_limited' | 'quota_exceeded' | 'server_error'

/** An error the API answers with `{ error, code }` and this status. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = (what = 'Not found') => new ApiError(404, 'not_found', what)
export const invalid = (why: string) => new ApiError(400, 'invalid_request', why)

/** One JSON line per event, for Workers Logs. */
export function log(event: string, data: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ...data }))
}

/** Read a JSON body of at most `maxBytes` bytes, without ever buffering more than that. */
export async function readJson(req: Request, maxBytes: number, tooLarge: string): Promise<unknown> {
  if (Number(req.headers.get('content-length')) > maxBytes) throw new ApiError(413, 'too_large', tooLarge)
  if (!req.body) throw invalid('Missing body')
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new ApiError(413, 'too_large', tooLarge)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw invalid('Invalid JSON')
  }
}

/** Headers for the app's HTML pages. */
export const PAGE_HEADERS: Record<string, string> = {
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    // React and CodeMirror set inline styles.
    "style-src 'self' 'unsafe-inline'",
    // Photos, videos and music the user picks are blob: URLs; project thumbnails are data: URLs.
    "img-src 'self' blob: data:",
    "media-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
}
