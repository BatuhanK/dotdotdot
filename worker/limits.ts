import { ApiError } from './http'

/**
 * Daily budget of one client. The per-minute limits are the `ratelimits` in wrangler.jsonc.
 * Both are generous for people, who publish a story or two, but cap scripts using shares as free storage.
 */
export const DAILY = {
  /** New share links. */
  shares: 300,
  /** Uploaded media, in bytes. */
  bytes: 2e9,
}

/** Who a request counts against: the client's IP, or its /64 for IPv6 (a home or phone usually gets a whole /64). */
export function clientKey(req: Request): string {
  const ip = req.headers.get('cf-connecting-ip') ?? 'local'
  if (!ip.includes(':')) return ip
  const [head, tail] = ip.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = tail === undefined ? left : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
  return `${groups
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(':')}::/64`
}

/** Throw 429 when this client went over a per-minute limit. A limiter missing from the config is skipped. */
export async function rateLimit(limiter: RateLimit | undefined, key: string): Promise<void> {
  if (!limiter) return
  const { success } = await limiter.limit({ key })
  if (!success) throw new ApiError(429, 'rate_limited', 'Too many requests. Try again in a minute.')
}

/** Throw 429 when this client used up today's budget. Skipped when the QUOTA Durable Object isn't configured. */
export async function spendDaily(env: Env, key: string, bucket: keyof typeof DAILY, amount: number): Promise<void> {
  const quotas = (env as Partial<Env>).QUOTA
  if (!quotas) return
  const ok = await quotas.get(quotas.idFromName(key)).spend(bucket, amount, DAILY[bucket])
  if (!ok) throw new ApiError(429, 'quota_exceeded', 'Daily limit reached. Try again tomorrow.')
}
