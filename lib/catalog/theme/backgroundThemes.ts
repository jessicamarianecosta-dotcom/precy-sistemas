/**
 * Temas prontos de fundo da vitrine pública (catalog_settings.background_theme).
 * Cada tema gera um `background` CSS (gradiente + textura leve via CSS puro,
 * sem imagens externas) que se mistura com a paleta da loja (--store-*), para
 * continuar coerente com qualquer cor principal escolhida pela lojista.
 *
 * "neutro" é o default — visualmente idêntico ao fundo liso de antes da
 * migration 114, então nenhuma loja já publicada muda de aparência sem ação
 * da lojista.
 */

export type BackgroundThemeId =
  | 'neutro' | 'elegante' | 'minimalista' | 'floral'
  | 'delicado' | 'moderno' | 'luxo' | 'artesanal'

export interface BackgroundThemeDef {
  id:    BackgroundThemeId
  label: string
  /** Pequena descrição para a grade de seleção no painel admin. */
  blurb: string
  /** CSS `background` (pode combinar vários gradientes em camadas). */
  css:   (mode: 'light' | 'dark') => string
}

export const BACKGROUND_THEMES: BackgroundThemeDef[] = [
  {
    id: 'neutro',
    label: 'Neutro',
    blurb: 'Fundo liso, só com a cor do tema da loja.',
    css: () => 'var(--store-bg)',
  },
  {
    id: 'elegante',
    label: 'Elegante',
    blurb: 'Vinheta sutil nos cantos, clima sofisticado.',
    css: mode => mode === 'dark'
      ? 'radial-gradient(ellipse 120% 80% at 50% -10%, color-mix(in srgb, var(--store-primary) 22%, transparent) 0%, transparent 60%), radial-gradient(ellipse 100% 60% at 50% 110%, rgba(0,0,0,0.5) 0%, transparent 70%), var(--store-bg)'
      : 'radial-gradient(ellipse 120% 80% at 50% -10%, color-mix(in srgb, var(--store-primary) 14%, transparent) 0%, transparent 60%), radial-gradient(ellipse 100% 60% at 50% 110%, color-mix(in srgb, var(--store-secondary) 10%, transparent) 0%, transparent 70%), var(--store-bg)',
  },
  {
    id: 'minimalista',
    label: 'Minimalista',
    blurb: 'Quase liso — uma textura quase imperceptível.',
    css: () => 'linear-gradient(180deg, color-mix(in srgb, var(--store-surface) 60%, transparent) 0%, transparent 10%), var(--store-bg)',
  },
  {
    id: 'floral',
    label: 'Floral',
    blurb: 'Pontos suaves espalhados, clima delicado e orgânico.',
    css: mode => `radial-gradient(circle at 12% 18%, color-mix(in srgb, var(--store-accent) ${mode === 'dark' ? 16 : 22}%, transparent) 0 6px, transparent 7px), ` +
      `radial-gradient(circle at 78% 32%, color-mix(in srgb, var(--store-primary) ${mode === 'dark' ? 14 : 18}%, transparent) 0 5px, transparent 6px), ` +
      `radial-gradient(circle at 40% 72%, color-mix(in srgb, var(--store-accent) ${mode === 'dark' ? 14 : 18}%, transparent) 0 7px, transparent 8px), ` +
      `radial-gradient(circle at 92% 85%, color-mix(in srgb, var(--store-primary) ${mode === 'dark' ? 12 : 16}%, transparent) 0 4px, transparent 5px), ` +
      'var(--store-bg)',
  },
  {
    id: 'delicado',
    label: 'Delicado',
    blurb: 'Gradiente pastel suave na diagonal.',
    css: mode => mode === 'dark'
      ? 'linear-gradient(160deg, color-mix(in srgb, var(--store-accent) 10%, transparent) 0%, transparent 45%, color-mix(in srgb, var(--store-secondary) 10%, transparent) 100%), var(--store-bg)'
      : 'linear-gradient(160deg, color-mix(in srgb, var(--store-accent) 12%, transparent) 0%, transparent 45%, color-mix(in srgb, var(--store-secondary) 8%, transparent) 100%), var(--store-bg)',
  },
  {
    id: 'moderno',
    label: 'Moderno',
    blurb: 'Blocos geométricos discretos, visual contemporâneo.',
    css: mode => `linear-gradient(135deg, transparent 0%, transparent 48%, color-mix(in srgb, var(--store-primary) ${mode === 'dark' ? 8 : 6}%, transparent) 48%, color-mix(in srgb, var(--store-primary) ${mode === 'dark' ? 8 : 6}%, transparent) 52%, transparent 52%), var(--store-bg)`,
  },
  {
    id: 'luxo',
    label: 'Luxo',
    blurb: 'Fundo escuro profundo com reflexo dourado sutil.',
    css: () => 'radial-gradient(ellipse 140% 70% at 50% 0%, color-mix(in srgb, var(--store-accent) 20%, transparent) 0%, transparent 55%), linear-gradient(180deg, #14110D 0%, #1C1712 100%)',
  },
  {
    id: 'artesanal',
    label: 'Artesanal',
    blurb: 'Tom terroso quente, como papel/kraft.',
    css: mode => mode === 'dark'
      ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 2px, transparent 2px, transparent 6px), var(--store-bg)'
      : 'repeating-linear-gradient(45deg, rgba(0,0,0,0.015) 0px, rgba(0,0,0,0.015) 2px, transparent 2px, transparent 6px), color-mix(in srgb, var(--store-secondary) 6%, var(--store-bg))',
  },
]

export function getBackgroundTheme(id: string | null | undefined): BackgroundThemeDef {
  return BACKGROUND_THEMES.find(t => t.id === id) ?? BACKGROUND_THEMES[0]
}
