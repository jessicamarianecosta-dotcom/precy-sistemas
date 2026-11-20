/**
 * Mapeamento Pedido/Cliente/Produtos (Precy+) → payload de NF-e (Bling
 * API v3) + detecção de campos obrigatórios que ainda faltam no cadastro.
 *
 * Nomes e obrigatoriedade de campo abaixo foram confirmados contra o
 * schema oficial (NotasFiscaisDadosBaseDTO/DadosPostDTO/ContatoDTO/
 * ContatoEnderecoDTO/ItemDTO/NaturezaOperacaoDTO) em
 * developer.bling.com.br em 2026-11-20 — ver lib/notasFiscais/README.md
 * para o que ainda depende de uma conta Bling real conectada (sobretudo
 * a existência de naturezas de operação já cadastradas na conta e a
 * aceitação do `contribuinte` derivado abaixo). `buildNfePayload` nunca
 * é chamado sem passar primeiro por `getMissingFields` na tela de
 * revisão.
 *
 * Mudanças de schema confirmadas em relação à primeira versão desta
 * implementação (que usava nomes de campo supostos, nunca validados):
 * - `naturezaOperacao` é um OBJETO `{ id }` referenciando um registro já
 *   cadastrado na conta Bling (GET /naturezas-operacoes) — nunca uma
 *   string livre. Não existe endpoint para criar um pela API v3 de NF-e;
 *   a usuária precisa ter (ou cadastrar manualmente no Bling) uma
 *   natureza de operação com a descrição esperada.
 * - NCM do item é `classificacaoFiscal`, não `ncm`.
 * - Não existe campo de CFOP no item da NF-e — o CFOP é resolvido pelo
 *   Bling a partir da natureza de operação escolhida, não enviado por
 *   nós por item.
 * - O item exige `codigo` (código/SKU do produto) — campo obrigatório
 *   que a primeira versão desta implementação não enviava.
 * - `contato.contribuinte` (1 Contribuinte do ICMS / 2 Isento / 9 Não
 *   contribuinte) é obrigatório e não existia na primeira versão.
 * - Não existe `codigoMunicipio`/IBGE no endereço do contato da NF-e —
 *   campo removido daqui (a primeira versão exigia e não deveria).
 * - `numero` e `dataOperacao` são obrigatórios no nível raiz da nota —
 *   a primeira versão não enviava nenhum dos dois.
 */

export interface MissingField {
  field: string
  label: string
  where: 'empresa' | 'cliente' | 'produto'
  productName?: string
}

/**
 * Dados da EMPRESA EMITENTE (cnpj, inscrição estadual, regime
 * tributário, endereço) não entram em nenhum lugar deste arquivo: a
 * referência oficial do POST /nfe não tem campo de emitente — a nota é
 * emitida em nome da própria conta Bling autenticada, cujo cadastro de
 * empresa (CNPJ/IE/regime/endereço) vive inteiramente do lado do Bling
 * (Cadastros → Empresas), fora do alcance desta API. Os campos
 * `companies.inscricao_estadual`/`regime_tributario` (migration
 * notas_fiscais_module.sql) continuam existindo no cadastro do Precy+
 * para referência/exibição da usuária, mas não bloqueiam mais a criação
 * da nota aqui — o que de fato bloqueia é a conta Bling conectada não
 * estar com seu próprio cadastro de empresa completo, algo que só se
 * descobre tentando criar a nota (o erro do Bling vem cru pra UI).
 */

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
}

interface OrderItemFiscalData {
  id: string
  name: string | null
  quantity: number
  unit_price: number
  unit: string | null
  /** SKU da variação do pedido, senão o id do produto — vira `codigo` (obrigatório) na NF-e. */
  code: string
  product_ncm: string | null
}

export function getMissingFields(
  customer: CustomerFiscalData,
  items: OrderItemFiscalData[],
): MissingField[] {
  const missing: MissingField[] = []

  if (!customer.cpf_cnpj) missing.push({ field: 'cpf_cnpj', label: 'CPF/CNPJ do cliente', where: 'cliente' })
  if (!customer.street || !customer.city || !customer.state || !customer.zip_code) {
    missing.push({ field: 'endereco_cliente', label: 'Endereço completo do cliente', where: 'cliente' })
  }
  // bairro é obrigatório no schema oficial (NotasFiscaisContatoEnderecoDTO.required)
  if (!customer.neighborhood) missing.push({ field: 'bairro_cliente', label: 'Bairro do cliente', where: 'cliente' })

  for (const item of items) {
    if (!item.product_ncm) {
      missing.push({ field: 'ncm', label: 'NCM do produto', where: 'produto', productName: item.name ?? undefined })
    }
  }

  return missing
}

/**
 * `contribuinte` (obrigatório em NotasFiscaisContatoDTO): 1 Contribuinte
 * do ICMS / 2 Contribuinte isento / 9 Não contribuinte. O cadastro de
 * cliente do Precy+ NÃO TEM campo de Inscrição Estadual hoje (só
 * `companies`, a empresa da própria usuária, tem) — então não há como
 * distinguir aqui um cliente pessoa jurídica contribuinte de um isento.
 * Derivação conservadora, não confirmada contra uma conta Bling real
 * (ver README): todo cliente vira "não contribuinte" (9), que é o caso
 * mais comum para quem vende a consumidor final/varejo (o público-alvo
 * da Precy+). Se a Bling rejeitar isso para algum cliente pessoa
 * jurídica específico, o erro cru da API aponta exatamente isso, e aí
 * vale adicionar Inscrição Estadual ao cadastro de cliente.
 */
function inferContribuinte(_customer: CustomerFiscalData): 9 {
  return 9
}

export function buildNfePayload(params: {
  customer: CustomerFiscalData
  items: OrderItemFiscalData[]
  naturezaOperacaoId: number
  orderNumber: string
}): Record<string, unknown> {
  const { customer, items, naturezaOperacaoId, orderNumber } = params

  return {
    tipo: 1, // 1 = saída (venda) — Precy+ só emite notas de venda, nunca de entrada
    numero: orderNumber,
    // formato "yyyy-MM-dd HH:mm:ss", confirmado no schema oficial (dataOperacao)
    dataOperacao: new Date().toISOString().slice(0, 19).replace('T', ' '),
    naturezaOperacao: { id: naturezaOperacaoId },
    numeroPedidoLoja: orderNumber,
    contato: {
      nome: customer.name,
      numeroDocumento: customer.cpf_cnpj,
      tipoPessoa: customer.person_type === 'juridica' ? 'J' : 'F',
      contribuinte: inferContribuinte(customer),
      endereco: {
        endereco: customer.street,
        numero: customer.number,
        bairro: customer.neighborhood,
        cep: customer.zip_code,
        municipio: customer.city,
        uf: customer.state,
        // Sem codigoMunicipio/IBGE: NotasFiscaisContatoEnderecoDTO não tem esse campo.
      },
    },
    itens: items.map(item => ({
      codigo: item.code,
      descricao: item.name ?? 'Item',
      unidade: item.unit || 'UN',
      quantidade: item.quantity,
      valor: item.unit_price,
      tipo: 'P', // P = Produto (nunca S/Serviço — Precy+ só emite NF-e de produto neste módulo)
      classificacaoFiscal: item.product_ncm, // NCM — nome de campo oficial, não "ncm"
      // Sem campo de CFOP no item: o Bling resolve o CFOP pela natureza de operação escolhida.
    })),
  }
}
