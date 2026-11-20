/**
 * Mapeamento Pedido/Cliente/Produtos (Precy+) → payload de NF-e (Bling
 * API v3) + detecção de campos obrigatórios que ainda faltam no cadastro.
 *
 * Mesmo aviso do lib/notasFiscais/blingClient.ts: o formato exato do
 * corpo de POST /nfe não foi confirmado contra a doc oficial nesta
 * sessão (developer.bling.com.br ficou fora de alcance). A forma abaixo
 * segue a convenção mais citada em integrações v3 (campos `contato`,
 * `itens`, `naturezaOperacao`, `tipo`) — precisa ser validada contra uma
 * conta Bling de teste real antes de habilitar emissão de produção (ver
 * lib/notasFiscais/README.md). `buildNfePayload` nunca é chamado sem
 * passar primeiro por `getMissingFields` na tela de revisão.
 */

export interface MissingField {
  field: string
  label: string
  where: 'empresa' | 'cliente' | 'produto'
  productName?: string
}

interface CompanyFiscalData {
  name: string
  cnpj: string | null
  inscricao_estadual: string | null
  regime_tributario: string | null
  street: string | null
  number: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zip_code: string | null
}

interface CustomerFiscalData {
  id: string
  name: string
  cpf_cnpj: string | null
  person_type: string | null
  street: string | null
  number: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  ibge_code: string | null
}

interface OrderItemFiscalData {
  id: string
  name: string | null
  quantity: number
  unit_price: number
  product_ncm: string | null
  product_cfop: string | null
}

export function getMissingFields(
  company: CompanyFiscalData,
  customer: CustomerFiscalData,
  items: OrderItemFiscalData[],
): MissingField[] {
  const missing: MissingField[] = []

  if (!company.cnpj) missing.push({ field: 'cnpj', label: 'CNPJ da empresa', where: 'empresa' })
  if (!company.inscricao_estadual) missing.push({ field: 'inscricao_estadual', label: 'Inscrição Estadual', where: 'empresa' })
  if (!company.regime_tributario) missing.push({ field: 'regime_tributario', label: 'Regime tributário', where: 'empresa' })
  if (!company.street || !company.city || !company.state || !company.zip_code) {
    missing.push({ field: 'endereco_empresa', label: 'Endereço completo da empresa', where: 'empresa' })
  }

  if (!customer.cpf_cnpj) missing.push({ field: 'cpf_cnpj', label: 'CPF/CNPJ do cliente', where: 'cliente' })
  if (!customer.street || !customer.city || !customer.state || !customer.zip_code) {
    missing.push({ field: 'endereco_cliente', label: 'Endereço completo do cliente', where: 'cliente' })
  }
  if (!customer.ibge_code) missing.push({ field: 'ibge_code', label: 'Código IBGE do município do cliente', where: 'cliente' })

  for (const item of items) {
    if (!item.product_ncm) {
      missing.push({ field: 'ncm', label: `NCM do produto`, where: 'produto', productName: item.name ?? undefined })
    }
    if (!item.product_cfop) {
      missing.push({ field: 'cfop', label: `CFOP do produto`, where: 'produto', productName: item.name ?? undefined })
    }
  }

  return missing
}

export function buildNfePayload(params: {
  company: CompanyFiscalData
  customer: CustomerFiscalData
  items: OrderItemFiscalData[]
  naturezaOperacao: string
  orderNumber: string
}): Record<string, unknown> {
  const { company, customer, items, naturezaOperacao, orderNumber } = params

  return {
    tipo: 1, // 1 = saída (venda) — Precy+ só emite notas de venda, nunca de entrada
    naturezaOperacao,
    numeroPedidoLoja: orderNumber,
    contato: {
      nome: customer.name,
      numeroDocumento: customer.cpf_cnpj,
      tipoPessoa: customer.person_type === 'juridica' ? 'J' : 'F',
      endereco: {
        endereco: customer.street,
        numero: customer.number,
        bairro: customer.neighborhood,
        cep: customer.zip_code,
        municipio: customer.city,
        uf: customer.state,
        codigoMunicipio: customer.ibge_code,
      },
    },
    itens: items.map(item => ({
      descricao: item.name ?? 'Item',
      quantidade: item.quantity,
      valor: item.unit_price,
      ncm: item.product_ncm,
      cfop: item.product_cfop,
    })),
  }
}
