/* ============================================================
   PRECY+ — Endereço de RETIRADA = endereço da PRÓPRIA empresa

   O Precy+ é multiusuário. NÃO existe endereço de retirada global/hardcoded.
   Quando a modalidade de entrega é "Retirada", o endereço mostrado é o que
   a empresa do usuário autenticado cadastrou em Configurações › Endereço.

   Se a empresa não tiver endereço cadastrado, retorna vazio — o chamador
   mostra um aviso ("Cadastre o endereço da empresa em Configurações").
   ============================================================ */

import { formatCep } from '@/lib/utils/mask'

export interface CompanyAddressParts {
  zip_code?: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  /** Campo legado de texto livre — usado como fallback quando os campos estruturados estão vazios. */
  address?: string | null
}

/**
 * Endereço de retirada da empresa, em até 3 linhas para exibição na UI e no PDF.
 * Retorna `[]` quando a empresa não tem nenhum dado de endereço.
 */
export function companyPickupAddressLines(co?: CompanyAddressParts | null): string[] {
  if (!co) return []

  const street = [co.street, co.number].filter(Boolean).join(', ')
  const line1 = [street, co.complement].filter(Boolean).join(' - ')
  const cityState = co.city && co.state
    ? `${co.city}/${co.state}`
    : (co.city || co.state || '')
  const line2 = [co.neighborhood, cityState].filter(Boolean).join(' - ')
  const line3 = co.zip_code ? `CEP ${formatCep(co.zip_code)}` : ''

  const lines = [line1, line2, line3].filter(Boolean)
  if (lines.length > 0) return lines

  // Fallback: campo `address` (texto livre)
  const legacy = (co.address ?? '').trim()
  return legacy ? [legacy] : []
}

/** Mesmo endereço em uma linha só — snapshot salvo em `budgets.delivery_addr`. `''` se não houver. */
export function companyPickupAddressText(co?: CompanyAddressParts | null): string {
  return companyPickupAddressLines(co).join(' - ')
}

/** true quando a empresa tem endereço suficiente para usar como local de retirada. */
export function hasCompanyPickupAddress(co?: CompanyAddressParts | null): boolean {
  return companyPickupAddressLines(co).length > 0
}
