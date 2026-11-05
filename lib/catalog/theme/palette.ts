/**
 * Geração e aplicação da paleta de cores da loja pública (catalog_settings.theme_palette).
 * Única fonte de verdade da identidade visual da loja — ver prompt de reformulação LumiLife.
 */

export type StoreThemeMode = 'light' | 'dark'

export interface StoreThemePalette {
  primary:        string
  secondary:      string
  accent:         string
  background:     string
  surface:        string
  text:           string
  textSecondary:  string
  border:         string
  buttonText:     string
}

export interface StoreThemePalettes {
  light: StoreThemePalette
  dark:  StoreThemePalette
}

const NEUTRAL_LIGHT = {
  background:    '#FFFFFF',
  surface:       '#F7F5F2',
  text:          '#1C1C1C',
  textSecondary: '#6B6B6B',
  border:        '#E5E1DB',
}

const NEUTRAL_DARK = {
  background:    '#1C1C1C',
  surface:       '#262220',
  text:          '#F5F5F4',
  textSecondary: '#A8A29E',
  border:        '#3A332C',
}

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return [Number.isNaN(r) ? 0 : r, Number.isNaN(g) ? 0 : g, Number.isNaN(b) ? 0 : b]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
}

/** Mistura `hex` com branco/preto (amount 0..1). amount > 0 clareia, < 0 escurece. */
export function mix(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const target = amount >= 0 ? 255 : 0
  const a = Math.abs(amount)
  return rgbToHex(
    r + (target - r) * a,
    g + (target - g) * a,
    b + (target - b) * a,
  )
}

/** Relative luminance aproximada — decide se texto sobre `hex` deve ser branco ou escuro. */
export function readableTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1C1C1C' : '#FFFFFF'
}

/** Gera a paleta completa (claro + escuro) a partir de uma única cor principal. */
export function generatePaletteFromBase(baseHex: string): StoreThemePalettes {
  const base = baseHex.toUpperCase()
  const lightPrimary = base
  const lightSecondary = mix(base, -0.2)
  const lightAccent = mix(base, 0.3)

  const darkPrimary = mix(base, 0.18)
  const darkSecondary = base
  const darkAccent = mix(base, 0.35)

  return {
    light: {
      primary: lightPrimary,
      secondary: lightSecondary,
      accent: lightAccent,
      ...NEUTRAL_LIGHT,
      buttonText: readableTextColor(lightPrimary),
    },
    dark: {
      primary: darkPrimary,
      secondary: darkSecondary,
      accent: darkAccent,
      ...NEUTRAL_DARK,
      buttonText: readableTextColor(darkPrimary),
    },
  }
}

/** Paleta efetiva: usa theme_palette se existir, senão gera a partir de theme_color (lojas antigas). */
export function resolvePalettes(settings: { theme_palette?: StoreThemePalettes | null; theme_color: string }): StoreThemePalettes {
  if (settings.theme_palette && settings.theme_palette.light && settings.theme_palette.dark) {
    return settings.theme_palette
  }
  return generatePaletteFromBase(settings.theme_color || '#8B6C4F')
}

const CSS_VAR_KEYS: Record<keyof StoreThemePalette, string> = {
  primary: '--store-primary',
  secondary: '--store-secondary',
  accent: '--store-accent',
  background: '--store-bg',
  surface: '--store-surface',
  text: '--store-text',
  textSecondary: '--store-text-secondary',
  border: '--store-border',
  buttonText: '--store-button-text',
}

export function paletteToCssVars(palette: StoreThemePalette): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const key of Object.keys(CSS_VAR_KEYS) as (keyof StoreThemePalette)[]) {
    vars[CSS_VAR_KEYS[key]] = palette[key]
  }
  return vars
}
