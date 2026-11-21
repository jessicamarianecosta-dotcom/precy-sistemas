/**
 * Paletas de cor da interface do Precy+ (Configurações > Aparência).
 * Os valores reais de cada token ficam em styles/globals.css, como
 * variáveis CSS por [data-palette="id"] — este arquivo só guarda os
 * metadados (id, nome, cores de amostra) usados pela UI de seleção e
 * pela prévia. Disponível tanto no Precy Essencial quanto no Precy Pro.
 *
 * Não confundir com lib/catalog/theme (tema da loja pública) nem com
 * companies.primary_color/secondary_color (cor de marca usada nos PDFs
 * de orçamento) — sistemas independentes, ver nota em globals.css.
 */

export type AppPaletteId = 'classico' | 'rosa' | 'verde' | 'azul' | 'roxo' | 'grafite'
export type AppThemeMode = 'light' | 'dark' | 'system'

export interface AppPaletteSwatch {
  id: AppPaletteId
  label: string
  /** Cores de amostra (iguais ao token 500/DEFAULT, secondary e 300 do CSS) — só para desenhar o seletor. */
  swatch: { primary: string; secondary: string; accent: string }
}

export const APP_PALETTES: AppPaletteSwatch[] = [
  { id: 'classico', label: 'Clássico', swatch: { primary: '#8B6C4F', secondary: '#B8956A', accent: '#C4A47B' } },
  { id: 'rosa',     label: 'Rosa',     swatch: { primary: '#C2487A', secondary: '#D98FB0', accent: '#E994B8' } },
  { id: 'verde',    label: 'Verde',    swatch: { primary: '#3F8A3C', secondary: '#74A851', accent: '#8AC585' } },
  { id: 'azul',     label: 'Azul',     swatch: { primary: '#2E6FC2', secondary: '#5B9BD9', accent: '#82AEE6' } },
  { id: 'roxo',     label: 'Roxo',     swatch: { primary: '#7536B4', secondary: '#A878D4', accent: '#AE79DB' } },
  { id: 'grafite',  label: 'Grafite',  swatch: { primary: '#566475', secondary: '#8793A1', accent: '#9CA9B6' } },
]

export const DEFAULT_PALETTE: AppPaletteId = 'classico'
export const DEFAULT_MODE: AppThemeMode = 'system'

export function isValidPaletteId(value: unknown): value is AppPaletteId {
  return typeof value === 'string' && APP_PALETTES.some(p => p.id === value)
}

export function getPaletteSwatch(id: AppPaletteId): AppPaletteSwatch {
  return APP_PALETTES.find(p => p.id === id) ?? APP_PALETTES[0]
}
