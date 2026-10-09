/** Share ids: easy to read aloud (no 0/O, 1/l/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
/** Bytes at or above this are skipped, so every character is equally likely. */
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length)

export function randomId(length = 10): string {
  let out = ''
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < UNBIASED_LIMIT && out.length < length) out += ALPHABET[byte % ALPHABET.length]
    }
  }
  return out
}

/** 192-bit secret, base64url. */
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** True when the request carries `Authorization: Bearer <token>` for a token with this SHA-256. */
export async function bearerMatches(req: Request, tokenHash: string): Promise<boolean> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return false
  return timingSafeEqual(await sha256Hex(token), tokenHash)
}
