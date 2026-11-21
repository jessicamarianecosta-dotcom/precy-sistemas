/**
 * Temas prontos de fundo da vitrine pública (catalog_settings.background_theme).
 * Cada tema é uma imagem de fundo (ilustração/textura), aplicada por trás de
 * toda a loja com uma camada de contraste automática por cima, para os cards
 * de produtos e categorias continuarem sempre legíveis.
 *
 * "neutro" é o default.
 */

export type BackgroundThemeId =
  | 'neutro' | 'elegante' | 'minimalista' | 'floral'
  | 'delicado' | 'moderno' | 'luxo' | 'artesanal'

export interface BackgroundThemeDef {
  id:    BackgroundThemeId
  label: string
  /** Pequena descrição para a grade de seleção no painel admin. */
  blurb: string
  /** Imagem de fundo do tema, em /public. */
  image: string
  /** Tema claro ou escuro — define a cor do texto/cards sobre a imagem. */
  mode:  'light' | 'dark'
}

export const BACKGROUND_THEMES: BackgroundThemeDef[] = [
  {
    id: 'neutro',
    label: 'Neutro',
    blurb: 'Ambiente claro e aconchegante, com plantas e luz suave.',
    image: '/backgrounds/neutro.jpg',
    mode: 'light',
  },
  {
    id: 'elegante',
    label: 'Elegante',
    blurb: 'Mármore e folhas douradas, clima sofisticado.',
    image: '/backgrounds/elegante.jpg',
    mode: 'light',
  },
  {
    id: 'minimalista',
    label: 'Minimalista',
    blurb: 'Formas suaves e linhas finas, visual limpo.',
    image: '/backgrounds/minimalista.jpg',
    mode: 'light',
  },
  {
    id: 'floral',
    label: 'Floral',
    blurb: 'Flores rosa em moldura completa, romântico e florido.',
    image: '/backgrounds/floral.jpg',
    mode: 'light',
  },
  {
    id: 'delicado',
    label: 'Delicado',
    blurb: 'Laço e flores esparsas em tom pastel.',
    image: '/backgrounds/delicado.jpg',
    mode: 'light',
  },
  {
    id: 'moderno',
    label: 'Moderno',
    blurb: 'Preto com linhas douradas, visual contemporâneo.',
    image: '/backgrounds/moderno.jpg',
    mode: 'dark',
  },
  {
    id: 'luxo',
    label: 'Luxo',
    blurb: 'Mármore escuro com coroa e detalhes dourados.',
    image: '/backgrounds/luxo.jpg',
    mode: 'dark',
  },
  {
    id: 'artesanal',
    label: 'Artesanal',
    blurb: 'Mesa de trabalho com fitas, tesoura e linho — clima handmade.',
    image: '/backgrounds/artesanal.jpg',
    mode: 'light',
  },
]

export function getBackgroundTheme(id: string | null | undefined): BackgroundThemeDef {
  return BACKGROUND_THEMES.find(t => t.id === id) ?? BACKGROUND_THEMES[0]
}
