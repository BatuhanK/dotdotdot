import { DurableObject } from 'cloudflare:workers'

const DAY_MS = 86_400_000
const today = () => new Date().toISOString().slice(0, 10)

/**
 * Daily budgets of one client (one object per IP, see limits.ts): how many shares it created and how
 * many bytes it uploaded today. The per-minute rate limits stop bursts; this stops slow, steady abuse.
 */
export class Quota extends DurableObject<Env> {
  /** Use `amount` of today's `bucket`. Returns false, and uses nothing, when that would go over `limit`. */
  async spend(bucket: string, amount: number, limit: number): Promise<boolean> {
    const key = `${today()}:${bucket}`
    const used = (await this.ctx.storage.get<number>(key)) ?? 0
    if (used + amount > limit) return false
    await this.ctx.storage.put(key, used + amount)
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + DAY_MS)
    return true
  }

  /** Forget the counters of past days. */
  async alarm(): Promise<void> {
    const keys = [...(await this.ctx.storage.list()).keys()]
    const old = keys.filter((k) => !k.startsWith(today()))
    if (old.length) await this.ctx.storage.delete(old)
    if (old.length < keys.length) await this.ctx.storage.setAlarm(Date.now() + DAY_MS)
  }
}
