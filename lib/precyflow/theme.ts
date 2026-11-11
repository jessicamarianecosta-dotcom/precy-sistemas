/**
 * PrecyFlow — definição dos dois temas aprovados (documento, seção 2).
 *
 * Tema Cat: paleta rosa fixa + mascote (gatinho). Tema Cores: seis cores
 * sólidas à escolha, sem mascote. Nenhum dos dois usa gradiente.
 */

export type PrecyflowTheme = 'cat' | 'cores'

export type PrecyflowColorId = 'rosa' | 'azul' | 'lilas' | 'preto' | 'verde' | 'marrom'

export interface PrecyflowColorOption {
  id: PrecyflowColorId
  label: string
  primary: string
  primaryHover: string
  primarySoft: string
}

// Cores sólidas do Tema Cores — extraídas pixel a pixel do arquivo oficial
// da marca (15_Landing_Page/Ilustracoes/paleta-tema-cores.png).
export const PRECYFLOW_COLORS: Record<PrecyflowColorId, PrecyflowColorOption> = {
  rosa:   { id: 'rosa',   label: 'Rosa',         primary: '#E94F88', primaryHover: '#C43B6E', primarySoft: '#FBE8F1' },
  azul:   { id: 'azul',   label: 'Azul-claro',   primary: '#78C9E8', primaryHover: '#58AFD1', primarySoft: '#E7F4FB' },
  lilas:  { id: 'lilas',  label: 'Lilás',        primary: '#A78BD8', primaryHover: '#8B6DC0', primarySoft: '#F0EBFB' },
  preto:  { id: 'preto',  label: 'Preto/Branco', primary: '#333333', primaryHover: '#111111', primarySoft: '#F2F2F2' },
  verde:  { id: 'verde',  label: 'Verde',        primary: '#55A979', primaryHover: '#418B61', primarySoft: '#E9F4EE' },
  marrom: { id: 'marrom', label: 'Marrom',       primary: '#8A5B43', primaryHover: '#6E4634', primarySoft: '#F2EAE4' },
}

// Tema Cat: paleta rosa fixa, extraída do wordmark oficial (mesmo rosa do
// mascote/laço) — não é selecionável, é o visual padrão do tema com mascote.
export const PRECYFLOW_CAT_PALETTE: PrecyflowColorOption = {
  id: 'rosa', label: 'Cat', primary: '#E94F88', primaryHover: '#C43B6E', primarySoft: '#FDF1F6',
}

export function resolvePrecyflowPalette(theme: PrecyflowTheme, color: PrecyflowColorId): PrecyflowColorOption {
  if (theme === 'cat') return PRECYFLOW_CAT_PALETTE
  return PRECYFLOW_COLORS[color] ?? PRECYFLOW_COLORS.rosa
}
