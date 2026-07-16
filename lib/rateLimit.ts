/**
 * Rate limit simples em memória, por IP + chave de rota.
 *
 * Limitação conhecida: cada instância serverless da Vercel tem sua própria
 * memória, então o limite real é "por instância quente", não global — não
 * substitui um rate limit distribuído (Upstash/Redis) se o tráfego crescer
 * o suficiente para justificar. Mas é uma mitigação real contra abuso de
 * script simples/spam em rotas públicas, sem exigir infraestrutura nova.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Evita crescimento ilimitado do Map em instâncias de longa duração.
function cleanup(now: number) {
  if (buckets.size < 5000) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key)
  }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

/**
 * @returns true se a requisição PODE prosseguir, false se estourou o limite.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  cleanup(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (existing.count >= limit) return false
  existing.count += 1
  return true
}
