import { supabaseAdmin } from '@/lib/supabase/admin'
import type { PaymentWebhookEvent } from '@/lib/catalog/payments/types'

/** Prefixo usado no `external_reference` da preferência do Mercado Pago, pra
 *  o webhook único (/api/webhooks/mercadopago) distinguir uma compra do
 *  Precy Montagem avulso de um pedido do Catálogo Online. */
export const MONTAGEM_REF_PREFIX = 'montagem_'

export function montagemRef(licenseId: string): string {
  return `${MONTAGEM_REF_PREFIX}${licenseId}`
}

function licenseIdFromRef(ref: string): string {
  return ref.slice(MONTAGEM_REF_PREFIX.length)
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

export type MontagemCascadeResult =
  | { ok: true; licenseId: string; alreadyProcessed?: true }
  | { ok: false; status: 'not_found'; warning: string }
  | { ok: false; status: 'error'; error: string }

/**
 * Confirma a compra avulsa do Precy Montagem: marca a licença aprovada e
 * calcula 1 ano de validade a partir de agora. Idempotente — reenvios do
 * mesmo webhook (comuns no Mercado Pago) não reprocessam uma licença já
 * aprovada nem estendem a validade de novo.
 */
export async function applyMontagemPaymentConfirmed(event: PaymentWebhookEvent): Promise<MontagemCascadeResult> {
  const licenseId = licenseIdFromRef(event.ref)

  const { data: license, error: fetchError } = await (supabaseAdmin.from('montagem_licenses') as any)
    .select('id, status')
    .eq('id', licenseId)
    .maybeSingle()

  if (fetchError) {
    return { ok: false, status: 'error', error: fetchError.message }
  }
  if (!license) {
    return { ok: false, status: 'not_found', warning: `Licença não encontrada para ref ${event.ref}` }
  }
  if (license.status === 'approved') {
    return { ok: true, licenseId, alreadyProcessed: true }
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + ONE_YEAR_MS)

  const { error: updateError } = await (supabaseAdmin.from('montagem_licenses') as any)
    .update({
      status: 'approved',
      mp_payment_id: String((event.raw as { id?: string | number })?.id ?? ''),
      approved_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq('id', licenseId)

  if (updateError) {
    return { ok: false, status: 'error', error: updateError.message }
  }

  return { ok: true, licenseId }
}
