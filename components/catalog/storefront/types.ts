import type { StoreThemePalettes } from '@/lib/catalog/theme/palette'
import type { BackgroundThemeId } from '@/lib/catalog/theme/backgroundThemes'

export type BannerHeight = 'sm' | 'md' | 'lg'
export type BannerImagePosition = 'left' | 'center' | 'right'
export type BackgroundType = 'theme' | 'image' | 'color'
export type BackgroundImageSize = 'cover' | 'repeat' | 'contain'

export interface StorefrontSettings {
  company_id:   string
  slug:         string
  logo_url:     string | null
  banner_url:   string | null
  description:  string | null
  whatsapp:     string | null
  instagram:    string | null
  facebook:     string | null
  tiktok:       string | null
  youtube:      string | null
  pinterest:    string | null
  website:      string | null
  city:         string | null
  state:        string | null
  address:      string | null
  business_hours: string | null
  policies_text: string | null
  theme_color:  string
  theme_palette: StoreThemePalettes | null

  // Banner principal (hero) — Seção 2 do redesign
  banner_height:         BannerHeight
  banner_image_position: BannerImagePosition
  banner_rounded:        boolean
  banner_show_text:      boolean
  banner_button_text:    string | null
  banner_button_link:    string | null

  // Aparência da loja / fundo — Seção 3 do redesign
  background_type:            BackgroundType
  background_theme:           BackgroundThemeId
  background_color:           string | null
  background_image_url:       string | null
  background_image_size:      BackgroundImageSize
  background_image_position:  BannerImagePosition
  background_overlay_opacity: number
}

export interface StorefrontProduct {
  id:                     string
  name:                   string
  final_price:            number
  catalog_starting_price: number | null
  catalog_promo_price:    number | null
  catalog_photos:         string[]
  catalog_category_id:    string | null
  created_at:             string
  /** Galeria normalizada (product_images), fonte de verdade a partir da migration 051.
   *  catalog_photos é mantido como fallback para produtos sem linhas aqui. */
  images?:                { id: string; url: string; sort_order: number; media_type?: 'image' | 'video'; is_primary?: boolean }[]
  hasVariants?:           boolean
}
