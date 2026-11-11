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

// Cores sólidas do Tema Cores — placeholder até a paleta oficial (PNG
// "paleta-tema-cores.png") ser conferida com os arquivos reais da marca.
export const PRECYFLOW_COLORS: Record<PrecyflowColorId, PrecyflowColorOption> = {
  rosa:   { id: 'rosa',   label: 'Rosa',         primary: '#D6498A', primaryHover: '#B83A72', primarySoft: '#FBE8F1' },
  azul:   { id: 'azul',   label: 'Azul-claro',   primary: '#4FA8D8', primaryHover: '#3C8BB8', primarySoft: '#E7F4FB' },
  lilas:  { id: 'lilas',  label: 'Lilás',        primary: '#9B7FD4', primaryHover: '#8266B8', primarySoft: '#F0EBFB' },
  preto:  { id: 'preto',  label: 'Preto/Branco', primary: '#2B2B2B', primaryHover: '#111111', primarySoft: '#F2F2F2' },
  verde:  { id: 'verde',  label: 'Verde',        primary: '#4C8C6B', primaryHover: '#3B6F54', primarySoft: '#E9F4EE' },
  marrom: { id: 'marrom', label: 'Marrom',       primary: '#8B6246', primaryHover: '#6E4C37', primarySoft: '#F2EAE4' },
}

// Tema Cat: paleta rosa fixa (não é selecionável — é o visual padrão do
// mascote, igual à referência do documento).
export const PRECYFLOW_CAT_PALETTE: PrecyflowColorOption = {
  id: 'rosa', label: 'Cat', primary: '#D6498A', primaryHover: '#B83A72', primarySoft: '#FDF1F6',
}

export function resolvePrecyflowPalette(theme: PrecyflowTheme, color: PrecyflowColorId): PrecyflowColorOption {
  if (theme === 'cat') return PRECYFLOW_CAT_PALETTE
  return PRECYFLOW_COLORS[color] ?? PRECYFLOW_COLORS.rosa
}
