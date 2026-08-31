/* ============================================================
   PRECY+ — Endereço fixo de RETIRADA (LumiLife)

   Aplicado automaticamente SOMENTE quando a modalidade de entrega
   for "Retirada" (delivery_type === 'pickup'), em orçamentos e nos
   pedidos gerados a partir deles.

   As demais modalidades (entrega, motoboy, correios, transportadora)
   continuam usando o endereço digitado / do cliente.
   ============================================================ */

export const PICKUP_ADDRESS = {
  line1: 'Rua Lupionópolis, 1473',
  district: 'Sítio Cercado',
  city: 'Curitiba',
  state: 'PR',
  cep: '81925-260',
} as const

/** Texto de uma linha — salvo em `budgets.delivery_addr` / `orders.delivery_addr`. */
export const PICKUP_ADDRESS_TEXT =
  'Rua Lupionópolis, 1473 - Sítio Cercado, Curitiba/PR - CEP 81925-260'

/** Bloco em 2 linhas — usado na UI e no PDF. */
export const PICKUP_ADDRESS_LINES = [
  PICKUP_ADDRESS.line1,
  `${PICKUP_ADDRESS.district} - ${PICKUP_ADDRESS.city}/${PICKUP_ADDRESS.state}`,
  `CEP ${PICKUP_ADDRESS.cep}`,
] as const

export const isPickup = (deliveryType?: string | null): boolean =>
  deliveryType === 'pickup'
