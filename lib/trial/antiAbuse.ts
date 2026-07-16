import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const DEVICE_ID_COOKIE = 'precy_device_id'
const IP_WINDOW_DAYS = 30
const IP_MAX_TRIALS_IN_WINDOW = 2

/**
 * Antiabuso de trial gratuito — decide no SERVIDOR (nunca confia no
 * client) se este device_id/IP já usou um trial recentemente.
 *
 * device_id: cookie httpOnly de primeira parte, gerado por nós (não é
 * fingerprint de terceiros) — sobrevive a limpar localStorage e a trocar
 * de e-mail, mas é apagado por "limpar cookies"/aba anônima. Por isso o
 * IP entra como segunda camada: pega os casos que escapam do cookie.
 *
 * Nenhuma das duas checagens bloqueia a criação da conta em si — apenas
 * decide se o bônus de 7 dias PRO é concedido. Falso positivo (ex:
 * computador compartilhado de coworking) só custa o bônus, nunca o uso
 * do produto (a conta continua funcional no plano Basic).
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

export function getOrCreateDeviceId(existing: string | undefined): { deviceId: string; isNew: boolean } {
  if (existing) return { deviceId: existing, isNew: false }
  return { deviceId: randomUUID(), isNew: true }
}

export async function isTrialAbusive(deviceId: string, ipHash: string): Promise<boolean> {
  const { count: deviceCount } = await (supabaseAdmin.from('trial_fingerprints') as any)
    .select('id', { count: 'exact', head: true })
    .eq('device_id', deviceId)
    .eq('trial_granted', true)
  if ((deviceCount ?? 0) > 0) return true

  const since = new Date(Date.now() - IP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { count: ipCount } = await (supabaseAdmin.from('trial_fingerprints') as any)
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('trial_granted', true)
    .gte('created_at', since)
  if ((ipCount ?? 0) >= IP_MAX_TRIALS_IN_WINDOW) return true

  return false
}

export async function recordTrialFingerprint(params: {
  deviceId: string
  ipHash: string
  companyId: string
  userId: string
  granted: boolean
}) {
  await (supabaseAdmin.from('trial_fingerprints') as any).insert([{
    device_id:     params.deviceId,
    ip_hash:       params.ipHash,
    company_id:    params.companyId,
    user_id:       params.userId,
    trial_granted: params.granted,
  }])
}
