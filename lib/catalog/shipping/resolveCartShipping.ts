import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ShippingItem } from './types'

export interface CartLineForShipping {
  productId: string
  quantity: number
}

export interface ShippingOriginSettings {
  originCep: string
  senderName: string
  senderDocument: string
  senderPhone: string
  street: string
  number: string
  complement: string | null
  district: string
  city: string
  state: string
  defaultWeightKg: number
  defaultLengthCm: number
  defaultWidthCm: number
  defaultHeightCm: number
}

/**
 * Empresa precisa ter configurado o remetente/origem (Configurações →
 * Catálogo → Dados de Envio) antes de cotar ou gerar etiqueta — nunca cai
 * num CEP genérico compartilhado entre lojas.
 */
export async function getShippingOriginSettings(companyId: string): Promise<ShippingOriginSettings | null> {
  const { data } = await (supabaseAdmin.from('catalog_shipping_settings') as any)
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  if (!data) return null

  return {
    originCep: String(data.origin_cep).replace(/\D/g, ''),
    senderName: data.sender_name,
    senderDocument: data.sender_document,
    senderPhone: data.sender_phone,
    street: data.origin_street,
    number: data.origin_number,
    complement: data.origin_complement ?? null,
    district: data.origin_district,
    city: data.origin_city,
    state: data.origin_state,
    defaultWeightKg: Number(data.default_weight_kg),
    defaultLengthCm: Number(data.default_length_cm),
    defaultWidthCm: Number(data.default_width_cm),
    defaultHeightCm: Number(data.default_height_cm),
  }
}

/**
 * Converte linhas de carrinho (productId + quantity) em ShippingItem[]
 * usando peso/dimensões reais do produto — nunca aceita esses valores do
 * client. Produto sem peso/dimensão cadastrado cai no padrão da empresa
 * (catalog_shipping_settings.default_*), consistente para cotação e etiqueta.
 */
export async function resolveShippingItems(
  companyId: string,
  lines: CartLineForShipping[],
  origin: ShippingOriginSettings
): Promise<ShippingItem[]> {
  const productIds = [...new Set(lines.map(l => l.productId))]
  if (productIds.length === 0) return []

  const { data: products } = await (supabaseAdmin.from('products') as any)
    .select('id, shipping_weight_kg, shipping_length_cm, shipping_width_cm, shipping_height_cm')
    .in('id', productIds)
    .eq('company_id', companyId)

  const byId = new Map((products ?? []).map((p: any) => [p.id, p]))

  return lines
    .filter(l => l.quantity > 0)
    .map(l => {
      const p: any = byId.get(l.productId)
      return {
        weightKg: Number(p?.shipping_weight_kg ?? origin.defaultWeightKg),
        lengthCm: Number(p?.shipping_length_cm ?? origin.defaultLengthCm),
        widthCm: Number(p?.shipping_width_cm ?? origin.defaultWidthCm),
        heightCm: Number(p?.shipping_height_cm ?? origin.defaultHeightCm),
        quantity: l.quantity,
      }
    })
}
